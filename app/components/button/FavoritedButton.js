import React from 'react'

import { useSetUpdateApi } from '~/contexts/updateApi'
import { useConfig } from '~/contexts/config'
import { useSettings } from '~/contexts/settings'
import { useSongDispatch } from '~/contexts/song'
import { useTheme } from '~/contexts/theme'
import { getApi, refreshApi } from '~/utils/api'
import { isServiceConfigured, setSharedStar } from '~/utils/songService'
import IconButton from '~/components/button/IconButton'
import RatingPopup from '~/components/popup/RatingPopup'
import logger from '~/utils/logger'

const FavoritedButton = ({ id, isFavorited = false, rating: initialRating = undefined, style = {}, size = 23 }) => {
	const [favorited, setFavorited] = React.useState(isFavorited)
	const [rating, setRating] = React.useState(initialRating ?? 0)
	const [isRatingOpen, setIsRatingOpen] = React.useState(false)
	const theme = useTheme()
	const config = useConfig()
	const settings = useSettings()
	const songDispatch = useSongDispatch()
	const setUpdateApi = useSetUpdateApi()

	React.useEffect(() => {
		setFavorited(isFavorited)
		setRating(initialRating ?? 0)
	}, [id, isFavorited, initialRating])

	const onPressFavorited = () => {
		getApi(config, favorited ? 'unstar' : 'star', { id, albumId: id, artistId: id })
			.then(() => {
				setFavorited(!favorited)
				// A starred song in the song service's shared library stays there, for as long as it is starred.
				// Anything else (albums, artists, songs of your own) is answered "not shared" and ignored.
				if (isServiceConfigured(settings)) setSharedStar(settings, id, !favorited).catch(() => { })
				refreshApi(config, 'getStarred2', null)
					.then(() => {
						setUpdateApi({ path: 'getStarred2', query: null, uid: 1 })
					})
			})
			.catch((e) => logger.error('FavoritedButton', e.message))
	}

	const onSaveRating = () => {
		getApi(config, 'setRating', { id, rating })
			.then(() => {
				songDispatch({ type: 'setRating', id, rating })
				setIsRatingOpen(false)
			})
			.catch((e) => logger.error('FavoritedButton', e.message))
	}

	return (
		<>
			<IconButton
				style={[{ padding: 20 }, style]}
				onPress={onPressFavorited}
				onLongPress={() => initialRating !== undefined ? setIsRatingOpen(true) : null}
				size={size}
				icon={favorited ? "heart" : "heart-o"}
				color={theme.primaryTouch}
			/>
			<RatingPopup
				visible={isRatingOpen}
				rating={rating}
				onSelectRating={setRating}
				onSave={onSaveRating}
				onClose={() => setIsRatingOpen(false)}
			/>
		</>
	)
}

export default FavoritedButton