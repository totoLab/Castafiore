import React from 'react'
import { useTranslation } from 'react-i18next'

import OptionsPopup from '~/components/popup/OptionsPopup'

/**
 * What can be done with a suggestion: keep it, or stop seeing it. The sheet has no cover header:
 * a suggestion is a catalogue song, not a song on the server yet, so its cover is not a server cover.
 */
const OptionsDiscover = ({ item, onClose, onKeep, onHideSong, onHideArtist }) => {
	const { t } = useTranslation()
	const ref = React.useRef()

	const run = (action) => () => {
		ref.current?.close()
		action(item)
	}

	if (!item) return null
	return (
		<OptionsPopup
			ref={ref}
			visible={true}
			close={onClose}
			options={[
				{ name: t('discover.Keep in my library'), icon: 'bookmark', onPress: run(onKeep), hidden: !item.shared },
				{ name: t('discover.Not interested in title', { title: item.title }), icon: 'close', onPress: run(onHideSong) },
				{ name: t('discover.Hide artist', { artist: item.artist }), icon: 'user', onPress: run(onHideArtist) },
			]}
		/>
	)
}

export default OptionsDiscover
