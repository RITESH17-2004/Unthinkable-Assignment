import os
from app.services.llm import generate_pre_visit_summary, generate_post_visit_summary
from app.core.config import settings

def test_llm_service():
    print("--- Starting LLM Service Test ---")
    
    # Check if keys are configured
    if settings.MISTRAL_API_KEY:
        print(f"[INFO] MISTRAL_API_KEY detected. Using model: {settings.MISTRAL_MODEL_NAME}")
    elif settings.GEMINI_API_KEY:
        print(f"[INFO] GEMINI_API_KEY detected. Using model: {settings.GEMINI_MODEL_NAME}")
    else:
        print("[INFO] No LLM API keys configured in .env. Test will run in FALLBACK mode.")

    # 1. Test Pre-Visit Summary
    test_symptoms = "I have a sudden sharp chest pain and slight shortness of breath since last 2 hours."
    print(f"\n1. Testing Pre-Visit Symptom Summary Generation for symptoms:\n  '{test_symptoms}'")
    
    pre_result = generate_pre_visit_summary(test_symptoms)
    print("\n--- Pre-Visit Result ---")
    print(f"Status:  {pre_result['status']}")
    print(f"Model:   {pre_result['model']}")
    print(f"Urgency: {pre_result['urgency']}")
    print(f"Chief Complaint: {pre_result['chief_complaint']}")
    print("Suggested Questions:")
    for q in pre_result['suggested_questions']:
        print(f"  - {q}")

    # 2. Test Post-Visit Summary
    test_clinical_notes = "Patient presents with acute chest discomfort. Heart rate is 92bpm. ECG is normal. Suspect gastroesophageal reflux (GERD) or muscle strain. Advise antacids and avoiding heavy meals before bed."
    test_prescriptions = "Omeprazole 20mg daily before breakfast (14 days), Gaviscon 10ml post meals prn."
    
    print(f"\n2. Testing Post-Visit Patient Summary Generation for notes:\n  '{test_clinical_notes}'\n  Prescriptions:\n  '{test_prescriptions}'")
    
    post_result = generate_post_visit_summary(test_clinical_notes, test_prescriptions)
    print("\n--- Post-Visit Result ---")
    print(f"Status:  {post_result['status']}")
    print(f"Model:   {post_result['model']}")
    print(f"Friendly Summary: {post_result['patient_summary']}")
    print("Care Instructions:")
    for i in post_result['follow_up_instructions']:
        print(f"  - {i}")

    print("\n--- LLM Service Test Completed ---")

if __name__ == "__main__":
    test_llm_service()
