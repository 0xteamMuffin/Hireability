# Model Files

This directory contains information about pre-trained models used in the HireAbility platform.

## AI Models Used

### Google Gemini Models

- **Gemini 1.5 Pro**: Used for interview analysis and feedback generation
- **Gemini Flash**: Used for question generation and document parsing

**Access**: These models are accessed via Google Gemini API. No local model files are required.

**API Key**: Set `GEMINI_API_KEY` in your environment variables.

### Face Detection Models (face-api.js)

Pre-trained models for facial expression detection are located in:

- `fe_hireability/public/models/`

**Models included:**

- `ssd_mobilenetv1_model-*` - Face detection model
- `face_expression_model-*` - Facial expression recognition model

**Source**: These models are loaded from the public directory at runtime. They are part of the face-api.js library.

## Model Links

### Google Gemini

- Documentation: https://ai.google.dev/gemini-api/docs
- Models: https://ai.google.dev/models/gemini

### Face-api.js

- Repository: https://github.com/justadudewhohacks/face-api.js
- Models: https://github.com/justadudewhohacks/face-api.js/tree/master/weights

## Usage

Models are automatically loaded when the application starts. No manual setup is required beyond API key configuration.
