import React from 'react'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'

import { getApi } from '~/utils/api'
import { useConfig } from '~/contexts/config'
import OptionsPopup from '~/components/popup/OptionsPopup'
import { shareText } from '~/utils/tools'
import useShareLinks from '~/utils/useShareLinks'
import { playSong, addToQueue } from '~/utils/player'
import { useSong, useSongDispatch } from '~/contexts/song'
import { getApiNetworkFirst, getApiCacheFirst } from '~/utils/api'

const OptionsAlbums = ({ albums, indexOptions, setIndexOptions }) => {
	const { t } = useTranslation()
	const song = useSong()
	const navigation = useNavigation()
	const config = useConfig()
	const refOption = React.useRef()
	const songDispatch = useSongDispatch()
	const shareLinks = useShareLinks(refOption)

	const playSimilarSongs = () => {
		getApiNetworkFirst(config, 'getSimilarSongs', { id: albums[indexOptions].id, count: 50 })
			.then((json) => {
				if (json.similarSongs?.song) playSong(config, songDispatch, json.similarSongs.song, 0)
			})
			.catch(() => { })
		refOption.current.close()
	}

	return (
		<OptionsPopup
			ref={refOption}
			visible={indexOptions >= 0}
			close={() => {
				shareLinks.cancel()
				refOption.current?.clearVirtualOptions()
				setIndexOptions(-1)
			}}
			item={indexOptions >= 0 ? albums[indexOptions] : null}
			options={[
				{
					name: t('Play similar songs'),
					icon: 'play',
					onPress: playSimilarSongs
				},
				{
					name: t('Add to queue'),
					icon: 'list-ul',
					onPress: () => {
						refOption.current.close()
						getApiCacheFirst(config, 'getAlbum', { id: albums[indexOptions].id })
							.then((json) => {
								if (json.album?.song?.length) {
									for (const song of json.album.song) {
										addToQueue(songDispatch, song)
									}
								}
							})
							.catch(() => { })
					},
					hidden: !song.queue?.length
				},
				{
					name: t('Go to artist'),
					icon: 'user',
					onPress: () => {
						refOption.current.close()
						navigation.navigate('Artist', { id: albums[indexOptions].artistId, name: albums[indexOptions].artist })
					}
				},
				{
					name: t('Share'),
					icon: 'share',
					onPress: () => {
						getApi(config, 'createShare', { id: albums[indexOptions].id })
							.then((json) => {
								if (json.shares.share.length > 0) shareText(json.shares.share[0].url)
							})
							.catch(() => { })
						refOption.current.close()
					}
				},
				{
					name: t('songService.Share album links'),
					icon: 'share',
					onPress: () => shareLinks.shareAlbum(albums[indexOptions]),
					hidden: !shareLinks.available
				},
				{
					name: t('Info'),
					icon: 'info',
					onPress: () => {
						refOption.current.close()
						refOption.current.showInfo(albums[indexOptions])
					}
				}
			]}
		/>
	)
}

export default OptionsAlbums