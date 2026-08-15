# PYTHON CODE JUST TO LIST ALL GEMINI MODELS THAT CAN USE

from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=api_key)

for model in client.models.list():
    if "generateContent" in model.supported_actions:
        print(model.name)