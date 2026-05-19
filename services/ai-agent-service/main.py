from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AI Agent Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GATEWAY_URL = os.getenv("GATEWAY_URL", "http://api-gateway:3000")

class ChatRequest(BaseModel):
    message: str

# In a real scenario, this would use LangChain's AgentExecutor with custom tools that call GATEWAY_URL.
# For demonstration in this assignment, we provide a mock conversational endpoint that understands basic intents.
@app.post("/api/agent/chat")
async def chat_with_agent(req: ChatRequest, x_user_id: str = Header(None)):
    msg = req.message.lower()
    
    # Mock Intent: Search
    if "search" in msg or "book" in msg or "hotel" in msg:
        if "rome" in msg or "istanbul" in msg or "izmir" in msg:
            city = "Rome" if "rome" in msg else ("Istanbul" if "istanbul" in msg else "Izmir")
            return {
                "reply": f"Got it! I can help you find hotels in {city}. Let me check the database for you. (Mock: Would call GET /api/hotels/search?city={city}...)",
                "action": "search",
                "params": {"city": city}
            }
    
    # Mock Intent: Confirmation
    if "yes" in msg and "book it" in msg:
        if not x_user_id:
            return {
                "reply": "You need to be logged in to make a reservation. Please log in first."
            }
        return {
            "reply": "Booking confirmed! (Mock: Called POST /api/hotels/book with your credentials). Have a great trip!",
            "action": "book"
        }

    return {
        "reply": "Hello! I am your AI assistant. I can help you search for hotels and make reservations. How can I assist you today?"
    }

@app.get("/health")
def health_check():
    return {"status": "OK"}
