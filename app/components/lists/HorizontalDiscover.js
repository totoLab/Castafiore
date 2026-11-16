import React from 'react'
import { Text, StyleSheet, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import Icon from '~/components/Icon'

import { useTheme } from '~/contexts/theme'
import ImageError from '~/components/ImageError'
import CustomFlat from '~/components/lists/CustomFlat'
import mainStyles from '~/styles/main'
import size from '~/styles/size'
import useSongRequests from '~/utils/useSongRequests'

/** One shelf of suggestions as a row of covers. Tapping a song plays it, adding it first if it is not on the server yet. */
const HorizontalDiscover = ({ items }) => {
	const { t } = useTranslation()
	const theme = useTheme()
	const { jobs, playItem } = useSongRequests()

	const renderItem = React.useCallback(({ item }) => {
		const job = jobs[item.id]
		const busy = job && !job.error && job.state !== 'done'
		return (
			<Pressable
				style={({ pressed }) => ([mainStyles.opacity({ pressed }), styles.song])}
				onPress={() => playItem(job?.subsonicId ? { ...item, cached: true, shared: false, subsonicId: job.subsonicId } : item)}
				disabled={busy}
				accessibilityLabel={item.cached ? t('songService.Play title', { title: item.title }) : t('songService.Get and play title', { title: item.title })}
			>
				<ImageError
					style={[styles.cover, { backgroundColor: theme.secondaryBack, opacity: busy ? 0.5 : 1 }]}
					source={{ uri: item.coverUrl }}
				/>
				{/* Not on the server yet: tapping downloads it. In the shared library: it leaves after a while unless kept. */}
				{!busy && (item.shared || !item.cached) && (
					<Icon name={item.shared ? 'clock-o' : 'cloud-download'} size={size.icon.tiny} color={theme.primaryText} style={styles.badge} />
				)}
				<Text numberOfLines={1} style={styles.title(theme)}>{item.title}</Text>
				<Text numberOfLines={1} style={styles.subtitle(theme, !!job?.error)}>
					{job?.error ? job.error : busy ? t(`songService.job.${job.state}`) : item.artist}
				</Text>
				<Text numberOfLines={1} style={styles.reason(theme)}>{item.reason}</Text>
			</Pressable>
		)
	}, [theme, jobs, playItem])

	return <CustomFlat data={items} renderItem={renderItem} widthItem={size.image.large + 15} />
}

const styles = StyleSheet.create({
	song: {
		width: size.image.large,
		alignItems: 'center',
	},
	cover: {
		width: size.image.large,
		height: size.image.large,
		marginBottom: 6,
	},
	badge: {
		position: 'absolute',
		top: 6,
		right: 6,
	},
	title: (theme) => ({
		color: theme.primaryText,
		fontSize: 13.5,
		fontWeight: '600',
		letterSpacing: -0.405,
		textAlign: 'left',
		width: size.image.large,
		marginBottom: 3,
		marginTop: 3,
	}),
	subtitle: (theme, error) => ({
		color: error ? theme.primaryTouch : theme.secondaryText,
		fontSize: 11.5,
		fontWeight: '500',
		lineHeight: 17,
		width: size.image.large,
		textAlign: 'left',
	}),
	reason: (theme) => ({
		color: theme.secondaryText,
		fontSize: 10.5,
		lineHeight: 15,
		width: size.image.large,
		textAlign: 'left',
		opacity: 0.8,
	}),
})

export default HorizontalDiscover
