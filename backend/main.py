from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId
import os
import json
from dotenv import load_dotenv

load_dotenv()

from database import patients_collection, reports_collection
import schemas

app = FastAPI(title="HealthCore AI - Medical Analytics API")  # 🔥 name changed

# ✅ CORS (important for frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------
# CREATE PATIENT
# -------------------------
@app.post("/patients/", response_model=schemas.Patient)
async def create_patient(patient: schemas.PatientCreate):
    existing = await patients_collection.find_one({
        "name": patient.name,
        "age": patient.age,
        "gender": patient.gender,
        "blood_group": patient.blood_group
    })

    if existing:
        raise HTTPException(status_code=409, detail="Patient already exists")

    new_patient = await patients_collection.insert_one(patient.model_dump())
    created_patient = await patients_collection.find_one({"_id": new_patient.inserted_id})
    return created_patient


# -------------------------
# GET PATIENT
# -------------------------
@app.get("/patients/{patient_id}", response_model=schemas.Patient)
async def read_patient(patient_id: str):
    if not ObjectId.is_valid(patient_id):
        raise HTTPException(status_code=400, detail="Invalid ID")

    patient = await patients_collection.find_one({"_id": ObjectId(patient_id)})
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    return patient


# -------------------------
# CREATE REPORT
# -------------------------
@app.post("/patients/{patient_id}/reports/", response_model=schemas.LabReport)
async def create_report_for_patient(patient_id: str, report: schemas.LabReportCreate):
    if not ObjectId.is_valid(patient_id):
        raise HTTPException(status_code=400, detail="Invalid ID")

    report_dict = report.model_dump()
    report_dict["patient_id"] = patient_id

    new_report = await reports_collection.insert_one(report_dict)
    created_report = await reports_collection.find_one({"_id": new_report.inserted_id})

    return created_report


# -------------------------
# GET REPORTS
# -------------------------
@app.get("/patients/{patient_id}/reports/", response_model=List[schemas.LabReport])
async def get_patient_reports(patient_id: str):
    if not ObjectId.is_valid(patient_id):
        raise HTTPException(status_code=400, detail="Invalid ID")

    reports = await reports_collection.find({"patient_id": patient_id}).to_list(100)
    return reports


# -------------------------
# DELETE PATIENT
# -------------------------
@app.delete("/patients/{patient_id}")
async def delete_patient(patient_id: str):
    if not ObjectId.is_valid(patient_id):
        raise HTTPException(status_code=400, detail="Invalid ID")

    await patients_collection.delete_one({"_id": ObjectId(patient_id)})
    await reports_collection.delete_many({"patient_id": patient_id})

    return {"message": "Deleted successfully"}


# -------------------------
# CHAT (SAFE FALLBACK ADDED 🔥)
# -------------------------
class ChatMessage(schemas.BaseModel):
    message: str
    patient_id: Optional[str] = None


@app.post("/chat")
async def ai_chat(chat: ChatMessage):
    api_key = os.getenv("GEMINI_API_KEY")

    # 🔥 SAFE FALLBACK (IMPORTANT CHANGE)
    if not api_key:
        return {
            "reply": f"CoreBot 🤖: Based on your query '{chat.message}', please consult a doctor for accurate diagnosis."
        }

    context = ""
    if chat.patient_id and ObjectId.is_valid(chat.patient_id):
        latest_report = await reports_collection.find_one(
            {"patient_id": chat.patient_id},
            sort=[("_id", -1)]
        )

        if latest_report:
            latest_report.pop("_id", None)
            latest_report.pop("patient_id", None)
            clean_report = {k: v for k, v in latest_report.items() if v is not None}
            context = f"\n\nPatient Report: {json.dumps(clean_report)}"

    prompt = f"You are a medical AI assistant.\n{context}\nUser: {chat.message}"

    try:
        import urllib.request
        import asyncio

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        payload = {"contents": [{"parts": [{"text": prompt}]}]}

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )

        loop = asyncio.get_event_loop()

        def fetch():
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode('utf-8'))

        res = await loop.run_in_executor(None, fetch)
        reply = res['candidates'][0]['content']['parts'][0]['text']

        return {"reply": reply}

    except:
        return {"reply": "AI service temporarily unavailable."}