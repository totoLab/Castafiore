import React from 'react'
import { View, Text, ScrollView, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import { useConfig } from '~/contexts/config'
import { useSettings } from '~/contexts/settings'
import { useTheme } from '~/contexts/theme'
import { getActivity, getDiscover, hideSuggestion, isServiceConfigured } from '~/utils/songService'
import Header from '~/components/Header'
import EmptyState from '~/components/EmptyState'
import IconButton from '~/components/button/IconButton'
import mainStyles from '~/styles/main'
import OptionsDiscover from '~/components/options/OptionsDiscover'
import RequestSongsList from '~/components/lists/RequestSongsList'
import SectionTitle from '~/components/SectionTitle'
import size from '~/styles/size'
import useSongRequests from '~/utils/useSongRequests'

const sameArtist = (a, b) => a.toLowerCase() === b.toLowerCase()

/**
 * Suggestions from what people play on the server, and what is popular right now.
 * Every song is playable: from the library, from the shared library, or fetched on tap.
 */
const Discover = () => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const settings = useSettings()
	const config = useConfig()
	const [shelves, setShelves] = React.useState(null)
	const [week, setWeek] = React.useState([])
	const [error, setError] = React.useState(null)
	const [selected, setSelected] = React.useState(null)
	const requests = useSongRequests()

	const load = (refresh = false) => {
		setError(null)
		if (refresh) setShelves(null)
		getDiscover(settings, refresh, config)
			.then((json) => setShelves(json.shelves))
			.catch((e) => {
				setShelves([])
				setError(e.message)
			})
		getActivity(settings, 7, config)
			.then((json) => setWeek(json.tracks ?? []))
			.catch(() => setWeek([]))
	}

	React.useEffect(() => {
		if (isServiceConfigured(settings)) load()
	}, [settings.songServiceUrl])

	const removeSong = (item) => {
		setShelves((prev) => prev?.map((s) => ({ ...s, items: s.items.filter((i) => i.id !== item.id) })))
		setWeek((prev) => prev.filter((i) => i.id !== item.id))
	}
	const removeArtist = (item) => {
		setShelves((prev) => prev?.map((s) => ({ ...s, items: s.items.filter((i) => !sameArtist(i.artist, item.artist)) })))
		setWeek((prev) => prev.filter((i) => !sameArtist(i.artist, item.artist)))
	}

	const hideSong = (item) => {
		removeSong(item)
		hideSuggestion(settings, { trackId: item.id }).catch((e) => setError(e.message))
	}
	const hideArtist = (item) => {
		removeArtist(item)
		hideSuggestion(settings, { artist: item.artist }).catch((e) => setError(e.message))
	}
	// Asking for a shared song links it into the user's own library, so it stays when the shared one rotates out.
	const keep = (item) => requests.ensure(item, { keep: true })

	const visible = shelves?.filter((s) => s.items.length > 0) ?? []

	return (
		<ScrollView
			style={mainStyles.mainContainer(theme)}
			contentContainerStyle={[mainStyles.contentMainContainer(insets), { paddingBottom: 80 }]}
		>
			<Header title={t('discover.Discover')} marginBottom={10} />
			{isServiceConfigured(settings) && (
				<View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginHorizontal: size.margin }}>
					<IconButton icon="refresh" size={size.icon.header} color={theme.primaryText} onPress={() => load(true)} />
				</View>
			)}
			{!isServiceConfigured(settings) && <EmptyState icon="compass" text={t('songService.Not configured')} />}
			{isServiceConfigured(settings) && !shelves && <ActivityIndicator size="large" color={theme.primaryTouch} />}
			{error && <Text style={{ marginHorizontal: 20, color: theme.secondaryText, fontSize: size.text.medium }}>{error}</Text>}
			{shelves && visible.length === 0 && week.length === 0 && !error && (
				<EmptyState icon="compass" text={t('discover.Nothing yet')} />
			)}
			{visible.map((shelf) => (
				<View key={shelf.id}>
					<SectionTitle title={shelf.title} />
					<RequestSongsList items={shelf.items} showReason onLongPress={setSelected} requests={requests} />
				</View>
			))}
			{week.length > 0 && (
				<View>
					<SectionTitle title={t('discover.Most played this week')} />
					<RequestSongsList items={week} showReason onLongPress={setSelected} requests={requests} />
				</View>
			)}
			<OptionsDiscover
				item={selected}
				onClose={() => setSelected(null)}
				onKeep={keep}
				onHideSong={hideSong}
				onHideArtist={hideArtist}
			/>
		</ScrollView>
	)
}

export default Discover
