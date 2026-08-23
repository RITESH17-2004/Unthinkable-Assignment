import json
import requests
import logging
from typing import Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)


def flatten_to_string(val: Any) -> str:
    """
    Recursively flattens nested dictionaries and lists into a readable plain string.
    Prevents React/frontend crashes when LLMs generate nested objects instead of raw strings.
    """
    if isinstance(val, dict):
        parts = []
        for k, v in val.items():
            k_clean = k.replace("_", " ").title()
            if isinstance(v, (dict, list)):
                parts.append(f"{k_clean}: {flatten_to_string(v)}")
            else:
                parts.append(f"{k_clean}: {v}")
        return " | ".join(parts)
    elif isinstance(val, list):
        return ", ".join(flatten_to_string(i) for i in val)
    return str(val)


def query_gemini_api(prompt: str, json_mode: bool = True) -> str:
    """
    Directly query the Google Gemini API using standard HTTP requests.
    """
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured.")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL_NAME}:generateContent?key={settings.GEMINI_API_KEY}"
    
    payload = {
        "contents": [{
            "parts": [{
                "text": prompt
            }]
        }]
    }

    if json_mode:
        payload["generationConfig"] = {
            "responseMimeType": "application/json"
        }

    headers = {
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=8.0)
        if response.status_code == 200:
            res_data = response.json()
            try:
                text_content = res_data["candidates"][0]["content"]["parts"][0]["text"]
                return text_content.strip()
            except (KeyError, IndexError) as e:
                logger.error(f"Malformed Gemini API response payload: {res_data}")
                raise Exception("Failed to parse text from Gemini response.")
        else:
            logger.error(f"Gemini API returned status {response.status_code}: {response.text}")
            raise Exception(f"Gemini API error: {response.text}")
    except requests.exceptions.Timeout:
        logger.error("Gemini API call timed out.")
        raise Exception("Gemini API call timed out.")
    except Exception as e:
        logger.error(f"Gemini API connection error: {e}")
        raise e


def query_mistral_api(prompt: str) -> str:
    """
    Directly query the Mistral AI API using standard HTTP requests.
    """
    if not settings.MISTRAL_API_KEY:
        raise ValueError("MISTRAL_API_KEY is not configured.")

    url = "https://api.mistral.ai/v1/chat/completions"
    
    payload = {
        "model": settings.MISTRAL_MODEL_NAME,
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "response_format": {
            "type": "json_object"
        }
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.MISTRAL_API_KEY}"
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=8.0)
        if response.status_code == 200:
            res_data = response.json()
            try:
                text_content = res_data["choices"][0]["message"]["content"]
                return text_content.strip()
            except (KeyError, IndexError) as e:
                logger.error(f"Malformed Mistral API response payload: {res_data}")
                raise Exception("Failed to parse text from Mistral response.")
        else:
            logger.error(f"Mistral API returned status {response.status_code}: {response.text}")
            raise Exception(f"Mistral API error: {response.text}")
    except requests.exceptions.Timeout:
        logger.error("Mistral API call timed out.")
        raise Exception("Mistral API call timed out.")
    except Exception as e:
        logger.error(f"Mistral API connection error: {e}")
        raise e


def generate_pre_visit_summary(symptoms: str) -> Dict[str, Any]:
    """
    Generates a structured pre-visit symptom analysis using Mistral or Gemini API.
    Gracefully falls back to local rules-based summary if API is missing or fails.
    """
    prompt = (
        "You are a professional medical AI assistant. Analyze the following patient symptoms "
        "and return a JSON object with the exact keys:\n"
        "1. \"urgency\": Urgency level. Must be exactly one of \"LOW\", \"MEDIUM\", or \"HIGH\".\n"
        "2. \"chief_complaint\": A brief 1-sentence summary of the patient's primary complaint.\n"
        "3. \"suggested_questions\": A list of exactly three relevant questions the doctor should ask the patient.\n\n"
        f"Patient symptoms:\n{symptoms}\n\n"
        "Return ONLY a valid JSON object matching the keys above. Do not include markdown code block formatting."
    )

    try:
        response_text = ""
        model_info = "fallback-local"
        
        if settings.MISTRAL_API_KEY:
            logger.info("Using Mistral API for pre-visit summary...")
            response_text = query_mistral_api(prompt)
            model_info = settings.MISTRAL_MODEL_NAME
        elif settings.GEMINI_API_KEY:
            logger.info("Using Gemini API for pre-visit summary...")
            response_text = query_gemini_api(prompt, json_mode=True)
            model_info = settings.GEMINI_MODEL_NAME
        else:
            raise ValueError("No LLM API keys configured.")
        
        data = json.loads(response_text)
        
        # Verify required keys
        if "urgency" in data and "chief_complaint" in data and "suggested_questions" in data:
            chief_complaint_val = data["chief_complaint"]
            chief_complaint_str = flatten_to_string(chief_complaint_val) if isinstance(chief_complaint_val, (dict, list)) else str(chief_complaint_val)
            
            questions = data["suggested_questions"]
            if not isinstance(questions, list):
                questions = [questions]
            else:
                questions = questions[:3]
                
            clean_questions = []
            for q in questions:
                if isinstance(q, (dict, list)):
                    clean_questions.append(flatten_to_string(q))
                else:
                    clean_questions.append(str(q))
            
            return {
                "urgency": str(data["urgency"]).upper(),
                "chief_complaint": chief_complaint_str,
                "suggested_questions": clean_questions,
                "model": model_info,
                "status": "SUCCESS"
            }
        else:
            raise ValueError("Response missing required keys")
            
    except Exception as e:
        logger.warning(f"LLM pre-visit generation failed ({e}). Triggering local fallback logic...")
        
        symptoms_lower = symptoms.lower()
        urgency = "LOW"
        if any(w in symptoms_lower for w in ["chest", "breath", "pain", "severe", "bleeding", "dizzy", "unconscious", "headache"]):
            urgency = "MEDIUM"
        if any(w in symptoms_lower for w in ["heart attack", "stroke", "seizure", "choking", "breathing difficulty"]):
            urgency = "HIGH"

        fallback_complaint = f"Patient presents with symptoms: {symptoms[:80]}..." if len(symptoms) > 80 else f"Patient presents with: {symptoms}"
        
        fallback_questions = [
            "How long have you been experiencing these symptoms, and have they worsened over time?",
            "Are there any specific triggers, activities, or positions that worsen or relieve the discomfort?",
            "Are you experiencing any associated symptoms like fever, nausea, dizziness, or localized pain?"
        ]

        return {
            "urgency": urgency,
            "chief_complaint": fallback_complaint,
            "suggested_questions": fallback_questions,
            "model": "fallback-local",
            "status": "FAILED"
        }


def generate_post_visit_summary(clinical_notes: str, prescriptions: str) -> Dict[str, Any]:
    """
    Translates raw clinical notes and prescriptions into a friendly, patient-oriented summary.
    Gracefully falls back to local rules-based summary if API is missing or fails.
    """
    prompt = (
        "You are a professional medical AI assistant. Translate the following doctor's clinical notes "
        "and prescriptions into a friendly, patient-oriented summary. Return a JSON object with the exact keys:\n"
        "1. \"patient_summary\": A warm, encouraging, easy-to-understand explanation of the doctor's notes in plain layman's terms. Avoid complex medical jargon.\n"
        "2. \"follow_up_instructions\": A list of clear, actionable instructions for follow-up care, dosage tracking, or warning signs to monitor.\n\n"
        f"Doctor's Clinical Notes:\n{clinical_notes}\n\n"
        f"Doctor's Prescriptions:\n{prescriptions}\n\n"
        "Return ONLY a valid JSON object matching the keys above. Do not include markdown code block formatting."
    )

    try:
        response_text = ""
        model_info = "fallback-local"
        
        if settings.MISTRAL_API_KEY:
            logger.info("Using Mistral API for post-visit summary...")
            response_text = query_mistral_api(prompt)
            model_info = settings.MISTRAL_MODEL_NAME
        elif settings.GEMINI_API_KEY:
            logger.info("Using Gemini API for post-visit summary...")
            response_text = query_gemini_api(prompt, json_mode=True)
            model_info = settings.GEMINI_MODEL_NAME
        else:
            raise ValueError("No LLM API keys configured.")
            
        data = json.loads(response_text)
        
        if "patient_summary" in data and "follow_up_instructions" in data:
            patient_summary_val = data["patient_summary"]
            patient_summary_str = flatten_to_string(patient_summary_val) if isinstance(patient_summary_val, (dict, list)) else str(patient_summary_val)
            
            instructions = data["follow_up_instructions"]
            if not isinstance(instructions, list):
                instructions = [instructions]
                
            clean_instructions = []
            for inst in instructions:
                if isinstance(inst, (dict, list)):
                    clean_instructions.append(flatten_to_string(inst))
                else:
                    clean_instructions.append(str(inst))
                
            return {
                "patient_summary": patient_summary_str,
                "follow_up_instructions": clean_instructions,
                "model": model_info,
                "status": "SUCCESS"
            }
        else:
            raise ValueError("Response missing required keys")
            
    except Exception as e:
        logger.warning(f"LLM post-visit generation failed ({e}). Triggering local fallback logic...")
        
        fallback_summary = f"Summary of clinical notes: {clinical_notes}"
        fallback_instructions = [
            "Please review and follow the doctor's prescribed instructions carefully.",
            f"Adhere strictly to medications as listed: {prescriptions}" if prescriptions else "Ensure you take all prescribed medications as instructed.",
            "Contact the clinic immediately or seek urgent care if your symptoms worsen."
        ]

        return {
            "patient_summary": fallback_summary,
            "follow_up_instructions": fallback_instructions,
            "model": "fallback-local",
            "status": "FAILED"
        }
