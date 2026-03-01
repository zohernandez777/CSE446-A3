from nba_api.stats.endpoints import playergamelogs; g=playergamelogs.PlayerGameLogs(player_id_nullable=893, season_nullable='1997-98'); print(len(g.get_data_frames()[0]))
