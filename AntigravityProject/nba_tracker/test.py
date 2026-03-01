from nba_api.stats.endpoints import playergamelog; g=playergamelog.PlayerGameLog(player_id=893); print(g.get_data_frames()[0])
