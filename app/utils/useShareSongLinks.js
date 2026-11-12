import React from 'react'
import { Platform } from 'react-native'
import { useTranslation } from 'react-i18next'

import { useSettings } from '~/contexts/settings'
import { getSongLinks, isServiceConfigured, songShareText } from '~/utils/songService'
import { shareText } from '~/utils/tools'

/**
 * Share a song as Deezer and Spotify links, found by the song service, from an options popup.
 * The popup says what is happening while the links are looked up, which can take a few seconds.
 * Call `cancel` when the popup closes, so a late answer does not open the share sheet.
 */
const useShareSongLinks = (refOption) => {
	const { t } = useTranslation()
	const settings = useSettings()
	const pending = React.useRef(0)

	const say = (name) => refOption.current?.setVirtualOptions([{ name }])

	const share = (song) => {
		const id = ++pending.current
		say(t('songService.Finding links'))
		getSongLinks(settings, song)
			.then(async (links) => {
				if (id !== pending.current) return
				if (!links.deezer && !links.spotify) return say(t('songService.No links found'))
				// The share sheet opens over the app, so the popup goes first; web copies and says so in the popup.
				if (Platform.OS !== 'web') refOption.current?.close()
				const result = await shareText(songShareText(song, links))
				if (result === 'copied' && id === pending.current) say(t('songService.Links copied'))
			})
			.catch((error) => {
				if (id === pending.current) say(error?.message ?? t('songService.No links found'))
			})
	}

	const cancel = () => { pending.current++ }

	return { share, cancel, available: isServiceConfigured(settings) }
}

export default useShareSongLinks
