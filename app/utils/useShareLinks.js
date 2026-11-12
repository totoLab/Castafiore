import React from 'react'
import { Platform } from 'react-native'
import { useTranslation } from 'react-i18next'

import { useSettings } from '~/contexts/settings'
import { albumShareText, getAlbumLinks, getSongLinks, isServiceConfigured, songShareText } from '~/utils/songService'
import { shareText } from '~/utils/tools'

/**
 * Share a song or an album as Deezer and Spotify links, found by the song service, from an options popup.
 * The popup says what is happening while the links are looked up, which can take a few seconds.
 * Call `cancel` when the popup closes, so a late answer does not open the share sheet.
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
			.then(async (links) => {
				if (id !== pending.current) return
				if (!links.deezer && !links.spotify) return say(notFound)
				// The share sheet opens over the app, so the popup goes first; web copies and says so in the popup.
				if (Platform.OS !== 'web') refOption.current?.close()
				const result = await shareText(toText(links))
				if (result === 'copied' && id === pending.current) say(t('songService.Links copied'))
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
