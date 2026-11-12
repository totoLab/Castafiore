import React from 'react'
import { Linking, Platform } from 'react-native'
import { useTranslation } from 'react-i18next'

import { useSettings } from '~/contexts/settings'
import { albumShareText, getAlbumLinks, getSongLinks, isServiceConfigured, songShareText } from '~/utils/songService'
import { shareText } from '~/utils/tools'

/**
 * Share a song or an album as Deezer and Spotify links, found by the song service, from an options popup.
 * The popup says what is happening while the links are looked up, which can take a few seconds,
 * then offers to share or copy them, or open them. Call `cancel` when the popup closes, so a late
 * answer does not replace the options of the next item.
 */
const useShareLinks = (refOption) => {
	const { t } = useTranslation()
	const settings = useSettings()
	const pending = React.useRef(0)

	const say = (name) => refOption.current?.setVirtualOptions([{ name }])

	const share = ({ finding, notFound, getLinks, toText }) => {
		const id = ++pending.current
		say(finding)
		getLinks()
			.then((links) => {
				if (id !== pending.current) return
				if (!links.deezer && !links.spotify) return say(notFound)
				const text = toText(links)
				// The popup stays open until you choose: on iOS a share sheet cannot open while the popup is closing.
				refOption.current?.setVirtualOptions([
					{
						name: t(Platform.OS === 'web' ? 'songService.Copy links' : 'songService.Share links'),
						icon: 'share',
						onPress: () => {
							shareText(text)
								.then((result) => {
									if (result === 'copied') say(t('songService.Links copied'))
									else refOption.current?.close()
								})
								.catch(() => { })
						},
					},
					links.deezer && {
						name: t('songService.Open in Deezer'),
						icon: 'external-link',
						onPress: () => Linking.openURL(links.deezer),
					},
					links.spotify && {
						name: t('songService.Open in Spotify'),
						icon: 'external-link',
						onPress: () => Linking.openURL(links.spotify),
					},
				].filter(Boolean))
			})
			.catch((error) => {
				if (id === pending.current) say(error?.message ?? notFound)
			})
	}

	const shareSong = (song) => share({
		finding: t('songService.Finding links'),
		notFound: t('songService.No links found'),
		getLinks: () => getSongLinks(settings, song),
		toText: (links) => songShareText(song, links),
	})

	const shareAlbum = (album) => share({
		finding: t('songService.Finding album links'),
		notFound: t('songService.No album links found'),
		getLinks: () => getAlbumLinks(settings, album),
		toText: (links) => albumShareText(album, links),
	})

	const cancel = () => { pending.current++ }

	return { shareSong, shareAlbum, cancel, available: isServiceConfigured(settings) }
}

export default useShareLinks
