import { Redirect } from 'expo-router';

/** Compatibility redirect for bookmarks to the retired setup screen. */
export default function RetiredTeamSetupRoute() {
  return <Redirect href="/" />;
}
