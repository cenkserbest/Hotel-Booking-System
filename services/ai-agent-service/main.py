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

def get_groq_client():
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY environment variable is not set!")
    return Groq(api_key=GROQ_API_KEY)

from typing import List, Dict, Any, Optional

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, Any]]] = []
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
    },
    {
        "type": "function",
        "function": {
            "name": "book_hotel",
            "description": "Book a specific hotel room for the user. Use this after search_hotels when the user selects a hotel to reserve.",
            "parameters": {
                "type": "object",
                "properties": {
                    "hotelId": {
                        "type": "integer",
                        "description": "Hotel ID from search results"
                    },
                    "roomId": {
                        "type": "integer",
                        "description": "Room ID from search results"
                    },
                    "startDate": {
                        "type": "string",
                        "description": "Check-in date in YYYY-MM-DD format"
                    },
                    "endDate": {
                        "type": "string",
                        "description": "Check-out date in YYYY-MM-DD format"
                    },
                    "basePrice": {
                        "type": "number",
                        "description": "Price per night for the room"
                    }
                },
                "required": ["hotelId", "roomId", "startDate", "endDate", "basePrice"]
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
        {"role": "system", "content": "You are a helpful hotel booking AI assistant. Help users search for hotels and make reservations. To search: ask for destination, dates, and number of guests, then call search_hotels. To book: after showing search results, if the user confirms a hotel, call book_hotel with the hotel/room IDs, dates, and base price from the search results. ALWAYS use YYYY-MM-DD format for dates."}
    ]

    if req.history:
        for msg in req.history:
            messages.append({"role": msg["role"], "content": msg["content"]})
    else:
        messages.append({"role": "user", "content": req.message})

    try:
        client = get_groq_client()
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=messages,
            tools=tools,
            tool_choice="auto",
        )
        
        response_message = response.choices[0].message
        
        if response_message.tool_calls:
            for tool_call in response_message.tool_calls:
                if tool_call.function.name == "search_hotels":
                    args = json.loads(tool_call.function.arguments)
                    url = f"{GATEWAY_URL}/api/v1/hotels/search?city={args['city']}&startDate={args['startDate']}&endDate={args['endDate']}&adults={args['adults']}"
                    
                    try:
                        res = requests.get(url, headers=headers, timeout=10)
                        data = res.json()
                        
                        hotel_list = data.get('data', data) if isinstance(data, dict) else data
                        if isinstance(hotel_list, list) and len(hotel_list) > 0:
                            return {
                                "reply": f"I found some great options in {args['city']} for your dates! Check them out below:",
                                "action": "show_hotels",
                                "hotels": hotel_list,
                                "searchParams": args
                            }
                        else:
                            return {"reply": f"I couldn't find any available hotels in {args['city']} for those dates. Try adjusting your dates."}
                    except Exception as e:
                        return {"reply": f"Sorry, the search failed due to an error: {str(e)}"}

                elif tool_call.function.name == "book_hotel":
                    args = json.loads(tool_call.function.arguments)
                    if not uid or uid == 'anonymous':
                        return {"reply": "You need to be logged in to make a booking. Please log in first."}
                    from datetime import date as date_cls
                    start = date_cls.fromisoformat(args['startDate'])
                    end = date_cls.fromisoformat(args['endDate'])
                    nights = (end - start).days
                    total_price = round(args['basePrice'] * nights, 2)
                    try:
                        book_url = f"{GATEWAY_URL}/api/v1/hotels/book"
                        res = requests.post(book_url, json={
                            "hotelId": args['hotelId'],
                            "roomId": args['roomId'],
                            "startDate": args['startDate'],
                            "endDate": args['endDate'],
                            "totalPrice": total_price
                        }, headers=headers, timeout=10)
                        if res.status_code == 201:
                            booking = res.json()
                            return {"reply": f"Your booking is confirmed! Booking ID: {booking['id']}. Total price: ${total_price} for {nights} night(s). Enjoy your stay!"}
                        else:
                            err = res.json()
                            return {"reply": f"Booking failed: {err.get('error', 'Unknown error')}"}
                    except Exception as e:
                        return {"reply": f"Booking request failed: {str(e)}"}
                        
        return {"reply": response_message.content or "Sorry, I didn't understand that."}
    except Exception as e:
        return {"reply": f"AI Error: {str(e)}"}

@app.get("/health")
def health_check():
    return {"status": "OK"}
