import useHardwareBackButton from '../hooks/useHardwareBackButton';

/**
 * Side-effect-only mount point for every Capacitor native bridge we use
 * across the app (hardware back, future push notifications, status-bar
 * theming, etc.). Renders nothing. Lives inside `<BrowserRouter>` so its
 * child hooks can read `useLocation()` / `useNavigate()`.
 */
export default function NativeBridge() {
  useHardwareBackButton();
  return null;
}
