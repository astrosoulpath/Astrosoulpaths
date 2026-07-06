import { appRoutes } from "@/src/navigation/routes";
import { Redirect } from "expo-router";

export default function AppStartRoute() {
  return <Redirect href={appRoutes.devNav} />;
}
