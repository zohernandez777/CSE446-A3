from nba_api.stats.endpoints import playergamelogs; g=playergamelogs.PlayerGameLogs(player_id_nullable=2544, season_nullable='2023-24'); print(len(g.get_data_frames()[0]))
