# TrueFit Vision

TrueFit Vision is a computer-vision based prototype for garment measurement and online clothing size recommendation.

Instead of assuming that the same S, M, or L size fits consistently across different brands and products, TrueFit Vision uses a garment the user already owns and likes as a personal sizing reference.

The system measures the reference garment, stores its dimensions as a reusable Fit Profile, reads retailer size-chart measurements, and recommends the closest available size based on dimensional similarity.

---

## Features

- Computer-vision based garment measurement
- A4 sheet calibration for physical scale estimation
- Automatic A4 reference detection
- Manual two-point calibration when automatic detection is inaccurate
- Reusable Fit Profiles
- PostgreSQL data storage
- OCR-assisted retailer size-chart extraction
- Manual review and correction of OCR results
- Support for centimeters and inches
- Automatic inch-to-centimeter conversion
- Closest-size recommendation
- Dimensional similarity score
- Match-quality classification
- Detailed size comparison
- Recommendation history
- Measurement validation dashboard
- Responsive web interface

---

## How It Works

### 1. Create a Fit Profile

The user uploads a photo of a garment they already own and know fits well.

An A4 sheet is placed beside the garment to provide a known physical reference.

TrueFit Vision uses the 29.7 cm edge of the A4 sheet to convert image pixels into real-world measurements.

The system estimates:

- Chest width
- Garment length

The user can review the measurements before saving the Fit Profile.

---

### 2. Calibrate the Image

TrueFit Vision first attempts to automatically detect the A4 sheet.

If automatic detection is not accurate, the user can manually click the two ends of the A4 sheet's 29.7 cm edge.

The application converts the selected distance from displayed-image coordinates to the original image coordinates before calculating the pixel-to-centimeter scale.

---

### 3. Save the Fit Profile

The measured garment dimensions are stored in PostgreSQL.

Each Fit Profile contains information such as:

- Profile name
- Reference garment name
- Preferred chest width
- Preferred garment length
- Fit preference

The saved profile can later be reused when comparing retailer products.

---

### 4. Upload a Retailer Size Chart

The user uploads a screenshot of a retailer size chart.

Tesseract.js OCR attempts to extract:

- Size labels
- Chest width
- Garment length

Because retailer charts vary in structure and image quality, the extracted measurements are displayed in an editable table.

The user can verify or correct the values before requesting a recommendation.

---

### 5. Handle Measurement Units

Retailer size charts may use either centimeters or inches.

TrueFit Vision allows the user to select the chart unit.

When the chart uses inches, measurements are converted to centimeters before comparison.

Conversion:

    1 inch = 2.54 cm

This allows all comparisons to use the same measurement unit internally.

---

### 6. Compare Available Sizes

Each retailer size is compared with the selected Fit Profile.

TrueFit Vision calculates the difference between:

- Reference garment chest width and retailer chest width
- Reference garment length and retailer garment length

The closest available size is identified using the combined dimensional difference.

The comparison uses both chest and length rather than relying only on an S, M, L, or XL label.

---

### 7. Dimensional Similarity Score

After selecting the closest size, TrueFit Vision calculates a dimensional similarity score.

Chest difference receives a larger weight than garment length because chest width is generally more important when comparing upper-body garments.

The score is used to describe the result as:

- Excellent match
- Good match
- Moderate match
- Distant match

The similarity score represents dimensional closeness, not a guarantee that the garment will physically fit.

---

## Computer Vision Pipeline

The measurement pipeline uses a clothing segmentation model to isolate the garment from the image.

Main stages:

1. Load the garment image
2. Correct image orientation when necessary
3. Detect or manually calibrate the A4 reference
4. Segment the garment
5. Convert the segmentation mask to a binary mask
6. Keep the largest connected garment region
7. Estimate torso width across multiple rows
8. Remove unusual width measurements using IQR filtering
9. Calculate median chest width
10. Calculate garment length
11. Convert pixel measurements to centimeters

The segmentation model used by the project is:

    mattmdjaga/segformer_b2_clothes

The model is loaded through Hugging Face Transformers.

---

## Recommendation Logic

For each retailer size, TrueFit Vision calculates:

    chest difference = retailer chest - preferred chest

    length difference = retailer length - preferred length

The overall dimensional difference is based on Euclidean distance:

    distance = sqrt(chest_difference² + length_difference²)

The size with the smallest distance is selected as the closest available size.

A separate similarity score is then calculated so that the application can distinguish between:

- A very close recommendation
- A reasonable recommendation
- A retailer chart where even the closest option is still relatively far from the saved garment

---

## Technology Stack

### Backend

- Python
- FastAPI
- Pydantic
- Psycopg2
- PostgreSQL

### Computer Vision

- OpenCV
- NumPy
- Pillow
- PyTorch
- Hugging Face Transformers
- SegFormer clothing segmentation model

### OCR

- Tesseract.js

### Frontend

- HTML
- CSS
- JavaScript
- Chart.js

---

## Project Structure

    TrueFit-Vision/
    │
    ├── app.py
    ├── pipeline.py
    ├── requirements.txt
    ├── README.md
    ├── .gitignore
    ├── .env.example
    │
    ├── 01_measurement_pipeline.ipynb
    ├── 02_fit_matching.ipynb
    │
    └── frontend/
        │
        ├── index.html
        │
        ├── css/
        │   └── styles.css
        │
        ├── js/
        │   └── app.js
        │
        └── images/

---

## Installation

### 1. Clone the Repository

    git clone https://github.com/YOUR_USERNAME/TrueFit-Vision.git

    cd TrueFit-Vision

---

### 2. Create a Virtual Environment

    python -m venv .venv

Activate it on Windows:

    .venv\Scripts\activate

---

### 3. Install Dependencies

    pip install -r requirements.txt

The main Python dependencies are:

- fastapi
- uvicorn
- python-multipart
- pydantic
- psycopg2-binary
- numpy
- opencv-python
- Pillow
- torch
- transformers
- python-dotenv

---

## Environment Variables

Create a `.env` file in the project root.

Example:

    DB_HOST=localhost
    DB_PORT=5432
    DB_NAME=truefit_vision
    DB_USER=postgres
    DB_PASSWORD=your_postgresql_password

A sample configuration is provided in:

    .env.example

The real `.env` file is excluded from Git through `.gitignore`.

Do not commit database passwords or other private credentials to GitHub.

---

## PostgreSQL Setup

Create the database:

    CREATE DATABASE truefit_vision;

The application uses PostgreSQL to store:

- Fit Profiles
- Garment validation measurements
- Size recommendation history

Example Fit Profile information:

- Profile name
- Reference garment
- Preferred chest width
- Preferred garment length
- Fit preference

Recommendation history stores information such as:

- Profile
- Product
- Recommended size
- Match quality
- Similarity score
- Chest difference
- Length difference
- Comparison data
- Date

---

## Run the Application

Start the FastAPI server:

    uvicorn app:app --reload

Then open:

    http://127.0.0.1:8000

FastAPI serves both the backend APIs and the frontend application.

---

## Example Demo Flow

A typical TrueFit Vision demonstration can follow this process:

### Create a Fit Profile

Profile:

    Krisha

Reference garment:

    Shirt 1

Fit preference:

    Regular

Example measured dimensions:

    Chest Width: 45.50 cm
    Garment Length: 67.28 cm

The reference garment is uploaded with an A4 sheet and measured using the computer-vision pipeline.

---

### Enter a Retailer Size Chart

Example retailer measurements in inches:

    Size    Chest Width    Length

    S       16             23
    M       16.5           24
    L       17             24.5
    XL      18.5           26

The user selects:

    Inches (in)

TrueFit Vision converts the measurements to centimeters before comparison.

For example:

    18.5 inches × 2.54 = 46.99 cm

    26 inches × 2.54 = 66.04 cm

These dimensions can then be compared with the saved Fit Profile.

---

## Measurement Validation

The computer-vision measurement pipeline was tested on four real garments.

| Garment | Actual Chest | Estimated Chest | Chest Error | Actual Length | Estimated Length | Length Error |
|---|---:|---:|---:|---:|---:|---:|
| Shirt 1 | 46.00 cm | 45.50 cm | 0.50 cm | 66.00 cm | 67.28 cm | 1.28 cm |
| Shirt 2 | 42.00 cm | 43.51 cm | 1.51 cm | 61.00 cm | 64.37 cm | 3.37 cm |
| Shirt 3 | 44.00 cm | 43.06 cm | 0.94 cm | 57.00 cm | 62.06 cm | 5.06 cm |
| Shirt 4 | 45.00 cm | 40.18 cm | 4.82 cm | 65.00 cm | 66.74 cm | 1.74 cm |

These results are displayed through the application's Dashboard.

This remains a pilot-scale validation rather than a production benchmark.

---

## Current Limitations

TrueFit Vision is a prototype and does not guarantee physical fit.

Measurement accuracy may be affected by:

- Camera perspective
- Garment positioning
- Segmentation quality
- Background conditions
- A4 calibration accuracy
- Garment shape
- Fabric behaviour
- Image quality

Size recommendations may also be influenced by:

- Fabric stretch
- Garment construction
- Body shape
- Brand-specific sizing
- Retailer measurement methods
- Incorrect retailer chart data
- OCR extraction errors

For this reason, the application describes its output as the closest dimensional match rather than a guaranteed fit prediction.

---

## OCR Limitations

Retailer size charts can differ significantly in:

- Layout
- Font
- Image resolution
- Column order
- Measurement terminology
- Units

OCR extraction is therefore designed as an assisted feature.

Users can review, edit, add, or remove size measurements before running the final comparison.

This keeps the recommendation process transparent even when OCR does not perfectly interpret the retailer chart.

---

## Future Improvements

Possible future improvements include:

- More robust size-chart OCR
- Automatic detection of chart units
- Support for more retailer chart layouts
- Larger garment validation datasets
- Perspective correction
- Improved automatic A4 detection
- Four-corner reference calibration
- Support for additional garment measurements
- Support for additional garment categories
- Improved fit-preference modelling
- More advanced recommendation methods
- Cloud deployment
- User authentication and persistent customer accounts

---

## Project Purpose

TrueFit Vision was developed as a portfolio project exploring how computer vision, OCR, backend APIs, databases, and recommendation logic can be combined to address a practical e-commerce problem.

The project demonstrates an end-to-end workflow involving:

    Image Upload
        ↓
    Computer Vision
        ↓
    Garment Measurement
        ↓
    Fit Profile
        ↓
    PostgreSQL
        ↓
    Retailer Size Chart
        ↓
    OCR + User Verification
        ↓
    Measurement Normalization
        ↓
    Dimensional Comparison
        ↓
    Closest Size Recommendation
        ↓
    Dashboard + Recommendation History

---

## Disclaimer

TrueFit Vision is an experimental prototype created for educational and portfolio purposes.

The recommendations are based on dimensional similarity between garments and should not be interpreted as guaranteed clothing-fit predictions.
