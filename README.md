# SmartEvent Modules 12-17 - Ready-to-Run Demo

This package implements Modules 12-17 in a simple runnable version.

## Backend
1. Open the `backend` folder in VS Code.
2. Open Terminal.
3. Create a virtual environment:
   `python -m venv venv`
4. Activate it on Windows:
   `venv\Scripts\activate`
5. Install packages:
   `pip install -r requirements.txt`
6. Start FastAPI:
   `uvicorn main:app --reload`
7. Open API docs:
   `http://127.0.0.1:8000/docs`

SQLite is used so you do not need PostgreSQL for this demo.

## Frontend
Open a second terminal:
1. `cd frontend`
2. `npm install`
3. `npm run dev`
4. Open the Vite URL shown in the terminal, normally:
   `http://localhost:5173`

## Demo flow
1. Register a user.
2. Login.
3. Search/filter events.
4. Select an event.
5. Choose ticket quantity.
6. Try coupon `SAVE10` or `FLAT100`.
7. Create booking.
8. Use Payment Checkout.
9. Click `Pay Successfully` or `Simulate Failure`.
10. Confirm notification.
11. Reviews are allowed only after a successful booking.

## Important
Payment is simulated, not a real Stripe payment. It is suitable for development/demo testing. For production, move secrets to environment variables and integrate Stripe Checkout/webhooks with server-side verification.
