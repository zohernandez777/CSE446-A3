# HoopStats: Premium NBA Tracker

HoopStats is a dynamic, modern, and visually stunning web application for tracking NBA player statistics. Built with an architecture utilizing Python (Flask) for the backend API, an SQLite database for caching, real-time fetching via `stats.nba.com`, and a premium frontend.

## Features
- **Premium Design:** Glassmorphism UI, glowing orbs background, subtle micro-animations, custom scrollbars, and a tailored dark-theme palette.
- **Dynamic Live Auto-Complete Search:** Instantly filter and search all 4,000+ historical and active players.
- **Live On-Demand Data:** Uncached player game logs are downloaded dynamically in real-time straight from the `nba_api`.
- **Interactive Visuals:** Clean Chart.js integrations including:
  - Line Chart: Scoring trend over time
  - Doughnut Chart: Shooting profile (FGM/FGA and 3PM/3PA logic)
  - Bar Chart: Cross-performance of Points vs Assists
- **Summary Metrics:** Automatically calculates Average Points/Rebounds/Assists, Player Efficiency Rating (PER proxy), and highlights the top-scoring game.

## Prerequisites
- Python 3.8+

## Setup & Run Instructions (Local)

1. **Navigate to project directory**
   ```bash
   cd nba_tracker
   ```

2. **(Optional) Create a virtual environment**
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On Mac/Linux:
   source venv/bin/activate
   ```

3. **Install Dependencies**
   Install the required backend packages.
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the Application**
   ```bash
   python app.py
   ```

5. **View in Browser**
   Open your browser and navigate to: [http://127.0.0.1:5000](http://127.0.0.1:5000)

## Cloud Deployment (e.g., Render.com or Heroku)
The repository is fully configured for PaaS (Platform as a Service) cloud deployments like **Render.com** or **Heroku**.

1. Create a free account on [Render.com](https://render.com).
2. Create a new **Web Service** and connect your GitHub repository containing this code.
3. Render will automatically detect the Python environment.
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app` (This utilizes the `Procfile` already included).
4. Click Deploy!
*Note: Because Render's free tier spins down idle instances, locally cached players in your SQLite DB `data/nba_stats.db` will be reset upon spin-down. The live `nba_api` fetching will still work perfectly to regenerate data dynamically for any user!*
