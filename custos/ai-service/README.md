# CUSTOS AI Service

FastAPI backend service for AI-powered features in CUSTOS.

## Features

- **Vision AI**: Extract student names from images using Google Gemini
- **RESTful API**: Clean, documented endpoints
- **CORS Enabled**: Works seamlessly with Next.js frontend

## Setup

### 1. Create Virtual Environment

```bash
cd ai-service
python -m venv venv
```

### 2. Activate Virtual Environment

**Windows:**
```bash
venv\Scripts\activate
```

**Mac/Linux:**
```bash
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` and add your Gemini API key:

```
GEMINI_API_KEY=your_actual_api_key_here
PORT=8000
```

**Get Gemini API Key:**
1. Go to https://ai.google.dev/
2. Click "Get API Key"
3. Create a new API key
4. Copy and paste into `.env`

### 5. Run the Server

```bash
python main.py
```

Or using uvicorn directly:

```bash
uvicorn main:app --reload --port 8000
```

Server will start at: http://localhost:8000

## API Endpoints

### Health Check
```
GET /
GET /health
```

### Extract Student Roster
```
POST /api/vision/extract-roster
Content-Type: multipart/form-data

Parameters:
- file: Image file (JPG, PNG, JPEG)

Response:
{
  "students": [
    {"name": "John Doe", "roll_number": "101"},
    {"name": "Jane Smith", "roll_number": "102"}
  ],
  "total_count": 2,
  "success": true,
  "message": "Successfully extracted 2 student(s)"
}
```

## Testing

### Test Health Endpoint

```bash
curl http://localhost:8000/health
```

### Test Vision API (with curl)

```bash
curl -X POST http://localhost:8000/api/vision/extract-roster \
  -F "file=@path/to/student-list.jpg"
```

## API Documentation

Once running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Troubleshooting

### Gemini API Not Configured
- Make sure `.env` file exists with valid `GEMINI_API_KEY`
- Restart the server after adding the key

### CORS Errors
- Ensure Next.js is running on http://localhost:3000
- Check `allow_origins` in `main.py`

### Image Upload Fails
- Check file size (max ~10MB recommended)
- Verify file type (JPG, PNG, JPEG only)
- Ensure valid image format

## Development

### Adding New Endpoints

1. Create endpoint in `main.py`:
```python
@app.post("/api/your-endpoint")
async def your_function():
    return {"message": "Hello"}
```

2. Add response model:
```python
class YourResponse(BaseModel):
    field: str
```

3. Document with docstring

### Environment Variables

- `GEMINI_API_KEY`: Google Gemini API key (required)
- `PORT`: Server port (default: 8000)

## Production Deployment

For production, use:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

Or with Gunicorn:

```bash
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## Tech Stack

- **FastAPI**: Modern Python web framework
- **Google Gemini**: AI vision model
- **Uvicorn**: ASGI server
- **Pillow**: Image processing
- **Pydantic**: Data validation

---

**Version**: 1.0.0  
**Last Updated**: Phase 2 - Day 1
