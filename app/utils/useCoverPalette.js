import React from 'react'
import { getColors } from 'react-native-image-colors'

import { distinctColors } from '~/components/share/cardLayout'

const FALLBACK = ['#2e2e2e', '#891116', '#121212', '#f5f5dc']

// Colour names react-native-image-colors gives on each platform, in the order they are offered.
const KEYS = {
	ios: ['background', 'primary', 'secondary', 'detail'],
	other: ['dominant', 'vibrant', 'darkVibrant', 'lightVibrant', 'muted', 'darkMuted', 'lightMuted', 'average'],
}

/** Up to four clearly different colours from a cover, for the lyric cards. */
const useCoverPalette = (uri) => {
	const [palette, setPalette] = React.useState(FALLBACK)

	React.useEffect(() => {
		if (!uri) {
			setPalette(FALLBACK)
			return
		}
		let active = true
		// A data URI (on web) is not a good cache key, so only server URLs are cached.
		const cache = !uri.startsWith('data:')
		getColors(uri, { fallback: FALLBACK[0], cache, key: cache ? `share:${uri}` : undefined })
			.then((colors) => {
				const keys = colors.platform === 'ios' ? KEYS.ios : KEYS.other
				const found = distinctColors(keys.map((key) => colors[key]))
				if (active) setPalette(found.length >= 2 ? found : distinctColors([...found, ...FALLBACK]))
			})
			.catch(() => { if (active) setPalette(FALLBACK) })
		return () => { active = false }
	}, [uri])

	return palette
}

export default useCoverPalette
