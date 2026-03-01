import sqlite3
import os
from nba_api.stats.static import players
from nba_api.stats.endpoints import playergamelog
import time

# Ensure data directory exists
data_dir = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(data_dir, exist_ok=True)
db_path = os.path.join(data_dir, 'nba_stats.db')

def init_db():
    print("Initializing Database...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create Players Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY,
            full_name TEXT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            is_active INTEGER
        )
    ''')
    
    # Create Game Logs Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS game_logs (
            game_id TEXT,
            player_id INTEGER,
            game_date TEXT,
            matchup TEXT,
            wl TEXT,
            min TEXT,
            fgm INTEGER,
            fga INTEGER,
            fg_pct REAL,
            fg3m INTEGER,
            fg3a INTEGER,
            fg3_pct REAL,
            ftm INTEGER,
            fta INTEGER,
            ft_pct REAL,
            oreb INTEGER,
            dreb INTEGER,
            reb INTEGER,
            ast INTEGER,
            stl INTEGER,
            blk INTEGER,
            tov INTEGER,
            pf INTEGER,
            pts INTEGER,
            plus_minus INTEGER,
            PRIMARY KEY (game_id, player_id),
            FOREIGN KEY (player_id) REFERENCES players(id)
        )
    ''')
    
    conn.commit()
    conn.close()
    print("Database Initialized.")

def populate_players():
    print("Fetching all historical NBA players from nba_api...")
    all_players = players.get_players()
    print(f"Found {len(all_players)} players.")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Insert or Ignore to avoid duplicating if the script is run multiple times
    count = 0
    for player in all_players:
        cursor.execute('''
            INSERT OR IGNORE INTO players (id, full_name, first_name, last_name, is_active)
            VALUES (?, ?, ?, ?, ?)
        ''', (player['id'], player['full_name'], player['first_name'], player['last_name'], 1 if player['is_active'] else 0))
        count += 1
        
    conn.commit()
    conn.close()
    print(f"Successfully populated {count} players into the database.")

def fetch_player_games(player_id, season="2023-24"):
    """
    Given a player ID, fetch their game log for a specific season and insert it into the DB.
    This demonstrates lazy-loading.
    """
    print(f"Fetching games for player ID: {player_id} for Season: {season}")
    try:
        gamelog = playergamelog.PlayerGameLog(player_id=player_id, season=season)
        # Sleep for a moment to prevent rate-limiting by stats.nba.com
        time.sleep(1)
        
        df = gamelog.get_data_frames()[0]
        
        if df.empty:
            print(f"No games found for player {player_id} in {season}")
            return 0
            
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        inserted = 0
        for index, row in df.iterrows():
            # Extract basic info
            try:
                cursor.execute('''
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
                if cursor.rowcount > 0:
                    inserted += 1
            except Exception as e:
                print(f"Error inserting row: {e}")
                
        conn.commit()
        conn.close()
        print(f"Inserted {inserted} new games for player {player_id}.")
        return inserted
        
    except Exception as e:
        print(f"Error fetching data from nba_api: {e}")
        return 0

if __name__ == '__main__':
    # 1. Initialize the SQLite structure
    init_db()
    
    # 2. Populate the massive list of all players (id, name, etc.)
    populate_players()
    
    # 3. For immediate testing, let's load the 2023-24 season for LeBron James (2544) and Stephen Curry (201939)
    # so we don't have to wait for the UI to request them to verify it works
    print("Prefetching some demo data for LeBron James and Stephen Curry...")
    fetch_player_games(2544, season="2023-24")
    fetch_player_games(201939, season="2023-24")
    print("Database seeding completed successfully.")
