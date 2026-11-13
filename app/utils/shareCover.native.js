import React from 'react'

import { urlCover } from '~/utils/url'

/**
 * The cover for a lyric card. On phones the captured image is drawn natively,
 * so the cover can stay a server URL, and the backdrop is the same image blurred by the Image component.
 */
const useShareCover = (config, song) => React.useMemo(() => {
	const cover = song ? urlCover(config, song, 600) : null
	return { cover, backdrop: cover, colorSource: cover, ready: true }
}, [config, song?.id])

export default useShareCover
