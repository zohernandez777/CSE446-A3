import sqlite3
import os
from flask import Flask, render_template, jsonify
from nba_api.stats.endpoints import playergamelog

app = Flask(__name__)

# Path to the database
DB_FILE = os.path.join(os.path.dirname(__file__), 'data', 'nba_stats.db')

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/')
def index():
    """Serve the main frontend application."""
    return render_template('index.html')

@app.route('/api/players')
def get_players():
    """API endpoint to get the list of active players for the dropdown."""
    if not os.path.exists(DB_FILE):
        return jsonify({"players": []})
        
    conn = get_db_connection()
    # For demo purposes, we will fetch only active players to keep the dropdown manageable
    players = conn.execute('SELECT id, full_name as name FROM players WHERE is_active = 1 ORDER BY full_name').fetchall()
    conn.close()
    
    return jsonify({"players": [dict(p) for p in players]})

@app.route('/api/player/games/<int:player_id>')
def get_player_games(player_id):
    """API endpoint to get game logs for a specific player."""
    if not os.path.exists(DB_FILE):
        return jsonify({"games": []})
        
    conn = get_db_connection()
    raw_games = conn.execute('''
        SELECT game_id, game_date as date, MATCHUP as opponent_raw, wl as result, 
               pts as points, reb as rebounds, ast as assists, stl as steals, 
               blk as blocks, tov as turnovers, fgm, fga, fg3m as threepm, 
               fg3a as threepa, ftm, fta
        FROM game_logs 
        WHERE player_id = ? 
        ORDER BY game_date ASC
    ''', (player_id,)).fetchall()
    
    # If games are entirely empty, use nba_api dynamically to fetch and save!
    if len(raw_games) == 0:
        print(f"No local data found for player {player_id}. Fetching live from stats.nba.com...")
        try:
            # Let's request the current 2023-24 season by default, 
            # or could expand this to fetch their entire career.
            # Add timeout to prevent hanging forever
            gamelog = playergamelog.PlayerGameLog(player_id=player_id, season="2023-24", timeout=5)
            df = gamelog.get_data_frames()[0]
            
            if not df.empty:
                for index, row in df.iterrows():
                    try:
                        conn.execute('''
                            INSERT OR IGNORE INTO game_logs (
                                game_id, player_id, game_date, matchup, wl, min,
                                fgm, fga, fg_pct, fg3m, fg3a, fg3_pct,
                                ftm, fta, ft_pct, oreb, dreb, reb,
                                ast, stl, blk, tov, pf, pts, plus_minus
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            row['Game_ID'], player_id, row['GAME_DATE'], row['MATCHUP'], row['WL'], row['MIN'],
                            row['FGM'], row['FGA'], row['FG_PCT'], row['FG3M'], row['FG3A'], row['FG3_PCT'],
                            row['FTM'], row['FTA'], row['FT_PCT'], row['OREB'], row['DREB'], row['REB'],
                            row['AST'], row['STL'], row['BLK'], row['TOV'], row['PF'], row['PTS'], row['PLUS_MINUS']
                        ))
                    except Exception as ins_err:
                        print(f"Database insertion failed: {ins_err}")
                conn.commit()
            else:
                # Insert a dummy record to prevent repeated API calls
                conn.execute('''
                    INSERT OR IGNORE INTO game_logs (
                        game_id, player_id, game_date, matchup, wl, min,
                        fgm, fga, fg_pct, fg3m, fg3a, fg3_pct,
                        ftm, fta, ft_pct, oreb, dreb, reb,
                        ast, stl, blk, tov, pf, pts, plus_minus
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', ('DUMMY', player_id, None, 'N/A', 'N/A', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0))
                conn.commit()
                print("No games found for this player. Inserted DUMMY cache record to prevent infinite reloading.")
            
            # Query one more time after successfully caching
            raw_games = conn.execute('''
                SELECT game_id, game_date as date, MATCHUP as opponent_raw, wl as result, 
                       pts as points, reb as rebounds, ast as assists, stl as steals, 
                       blk as blocks, tov as turnovers, fgm, fga, fg3m as threepm, 
                       fg3a as threepa, ftm, fta
                FROM game_logs 
                WHERE player_id = ? 
                ORDER BY game_date ASC
            ''', (player_id,)).fetchall()
            print("Live database injection complete!")
        except Exception as e:
            print(f"Failed to fetch data dynamically via nba_api: {str(e)}")
            
    conn.close()
    
    # Filter out dummy placeholder rows
    games = [g for g in raw_games if dict(g).get('game_id') != 'DUMMY']
    
    # Process game records to match our frontend format
    processed_games = []
    for g in games:
        g_dict = dict(g)
        
        # Determine opponent from matchup string (e.g. "LAL @ DEN" or "LAL vs. DEN")
        matchup = g_dict['opponent_raw']
        opponent = matchup.split()[-1] if matchup else "UNK"
        g_dict['opponent'] = opponent
        
        # Calculate a pseudo-season based on game_date (e.g., "2023-10-24" -> "2023-24")
        date_str = g_dict['date']
        if date_str:
            # Handle formats like "OCT 24, 2023" vs "2023-10-24"
            if "," in date_str:
                # E.g. OCT 24, 2023
                parts = date_str.replace(',', '').split()
                year = int(parts[2])
                month_str = parts[0].upper()
                months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
                month = months.index(month_str) + 1 if month_str in months else 1
            else:
                # Assume YYYY-MM-DD
                year = int(date_str[:4])
                month = int(date_str[5:7])
                
            if month >= 10:
                season = f"{year}-{str(year+1)[-2:]}"
            else:
                season = f"{year-1}-{str(year)[-2:]}"
        else:
            season = "Unknown"
        g_dict['season'] = season
        
        processed_games.append(g_dict)
        
    # Return some mock team info as well just to fill the header
    return jsonify({
        "games": processed_games,
        "team": "NBA Team",
        "position": "Player"
    })

if __name__ == '__main__':
    # Run the Flask app on localhost:5000 with debug enabled
    app.run(debug=True, port=5000)
