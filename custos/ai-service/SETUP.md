# Phase 2 AI Service Setup Guide

## 🚀 **Quick Start**

### **Step 1: Get Gemini API Key** (FREE)

1. Go to https://aistudio.google.com/apikey
2. Click **"Get API Key"** or **"Create API Key"**
3. Select **"Create API key in new project"**
4. Copy the API key

### **Step 2: Configure Environment**

1. Navigate to `ai-service` folder
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` and paste your API key:
   ```
   GEMINI_API_KEY=YOUR_ACTUAL_KEY_HERE
   PORT=8000
   ```

### **Step 3: Verify Setup**

Your `ai-service` folder should have:
```
ai-service/
├── venv/              ← Virtual environment (created)
├── main.py            ← FastAPI server
├── requirements.txt   ← Dependencies
├── .env              ← Your API key (YOU NEED TO CREATE THIS!)
├── .env.example      ← Template
└── README.md         ← Documentation
```

### **Step 4: Run the AI Service**

**Option A: Using Python directly**
```bash
cd ai-service
venv\Scripts\activate
python main.py
```

**Option B: Using uvicorn**
```bash
cd ai-service
venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

✅ **Server running at:** http://localhost:8000

---

## 🧪 **Testing the AI Service**

### **1. Health Check**

Open browser: http://localhost:8000

You should see:
```json
{
  "service": "CUSTOS AI Service",
  "version": "1.0.0",
  "status": "running",
  "gemini_configured": true
}
```

### **2. API Documentation**

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### **3. Test Vision AI** (using Swagger)

1. Go to http://localhost:8000/docs
2. Find `/api/vision/extract-roster`
3. Click **"Try it out"**
4. Upload an image with student names
5. Click **"Execute"**
6. See the extracted names!

---

## 📝 **Creating a Test Image**

You can test with a simple handwritten list:

1. Open Notepad or Paint
2. Write a list of names:
   ```
   1. John Doe
   2. Jane Smith
   3. Bob Johnson
   4. Alice Williams
   ```
3. Take a screenshot or save as image
4. Upload to the API

---

## ❌ **Troubleshooting**

### **"Gemini API is not configured"**
- Make sure you created `.env` file (not just `.env.example`)
- Check that `GEMINI_API_KEY` is set correctly
- Restart the server after adding the key

### **"Module not found" errors**
```bash
# Make sure virtual environment is activated
venv\Scripts\activate

# Reinstall dependencies
pip install -r requirements.txt
```

### **Port 8000 already in use**
Change port in `.env`:
```
PORT=8001
```

### **CORS errors from Next.js**
- Make sure both servers are running (Next.js on 3000, FastAPI on 8000)
- Check `allow_origins` in `main.py`

---

## 🎯 **Next Steps**

Once the AI service is running:

1. ✅ Test the health endpoint
2. ✅ Test vision AI with a sample image
3. ✅ Move to frontend integration (bulk user creation UI)

---

## 🔑 **Important Notes**

- **API Key**: Keep it secret! Don't commit `.env` to Git
- **Free Tier**: Gemini has generous free tier limits
- **Rate Limits**: Be mindful of API usage

---

## 📊 **Status Checklist**

- [ ] Virtual environment created
- [ ] Dependencies installed
- [ ] `.env` file created with API key
- [ ] Server starts without errors
- [ ] Health check returns success
- [ ] Can access Swagger UI
- [ ] Vision AI endpoint tested

---

**Ready to test? Let's go!** 🚀
