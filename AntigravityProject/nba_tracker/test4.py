from nba_api.stats.endpoints import commonplayerinfo; info=commonplayerinfo.CommonPlayerInfo(player_id=893); print(info.get_data_frames()[0][[" FROM_YEAR\, \TO_YEAR\]])
