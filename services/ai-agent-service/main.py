from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import os
import json
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

app = FastAPI(title="AI Agent Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GATEWAY_URL = os.getenv("GATEWAY_URL", "http://api-gateway:3000")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    print("WARNING: GROQ_API_KEY is not set!")

client = Groq(api_key=GROQ_API_KEY)

class ChatRequest(BaseModel):
    message: str
    user_id: str = None

# Tool definitions for Groq
tools = [
    {
        "type": "function",
        "function": {
            "name": "search_hotels",
            "description": "Search for available hotels in a destination city for specific dates and number of adults.",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "The destination city (e.g., Rome, Istanbul)"
                    },
                    "startDate": {
                        "type": "string",
                        "description": "The check-in date in YYYY-MM-DD format"
                    },
                    "endDate": {
                        "type": "string",
                        "description": "The check-out date in YYYY-MM-DD format"
                    },
                    "adults": {
                        "type": "integer",
                        "description": "Number of adults"
                    }
                },
                "required": ["city", "startDate", "endDate", "adults"]
            }
        }
    }
]

@app.post("/api/agent/chat")
async def chat_with_agent(req: ChatRequest, x_user_id: str = Header(None)):
    uid = x_user_id or req.user_id
    headers = {}
    if uid and uid != 'anonymous':
        headers['x-user-id'] = uid

    messages = [
        {"role": "system", "content": "You are a helpful hotel booking AI assistant. If the user wants to search for a hotel, ask them for the destination, dates, and number of guests. Once you have all info, call the search_hotels tool. ALWAYS use YYYY-MM-DD format for dates."},
        {"role": "user", "content": req.message}
    ]

    try:
        response = client.chat.completions.create(
            model="llama3-8b-8192",
            messages=messages,
            tools=tools,
            tool_choice="auto",
        )
        
        response_message = response.choices[0].message
        
        if response_message.tool_calls:
            for tool_call in response_message.tool_calls:
                if tool_call.function.name == "search_hotels":
                    args = json.loads(tool_call.function.arguments)
                    url = f"{GATEWAY_URL}/api/hotels/search?city={args['city']}&startDate={args['startDate']}&endDate={args['endDate']}&adults={args['adults']}"
                    
                    try:
                        res = requests.get(url, headers=headers, timeout=10)
                        data = res.json()
                        
                        if isinstance(data, list) and len(data) > 0:
                            return {
                                "reply": f"I found some great options in {args['city']} for your dates! Check them out below:",
                                "action": "show_hotels",
                                "hotels": data,
                                "searchParams": args
                            }
                        else:
                            return {"reply": f"I couldn't find any available hotels in {args['city']} for those dates. Try adjusting your dates."}
                    except Exception as e:
                        return {"reply": f"Sorry, the search failed due to an error: {str(e)}"}
                        
        return {"reply": response_message.content or "Sorry, I didn't understand that."}
    except Exception as e:
        return {"reply": f"AI Error: {str(e)}"}

@app.get("/health")
def health_check():
    return {"status": "OK"}
