import { useEffect } from 'react';
import { listenPushNotificationResponses } from './push/push-registration';
import { ROUTES } from './constants/routes';
import { useNavigation } from './hooks/useNavigation';

export function NotificationDeepLinkHandler() {
  const { navigate } = useNavigation();
  useEffect(() => {
    return listenPushNotificationResponses((payload) => {
      const ref = payload.ref as { type?: string; id?: string } | undefined;
      const key = (payload.templateKey ?? payload.key ?? '') as string;
      if (ref) {
        const refType = ref.type ?? '';
        const refId = ref.id ?? '';
        if (refType === 'order' || refType === 'purchase') {
          navigate(ROUTES.ORDERS);
        } else if (refType === 'stream' || refType === 'sale') {
          navigate(ROUTES.DISCOVER);
        } else if (refType === 'message') {
          navigate(ROUTES.INBOX);
        } else {
          navigate(ROUTES.INBOX);
        }
        return;
      }
      // Basic screen-level navigation based on templateKey when no structured ref exists.
      if (key.includes('order') || key.includes('purchase')) {
        navigate(ROUTES.ORDERS);
      } else if (key.includes('sale') || key.includes('auction') || key.includes('bid')) {
        navigate(ROUTES.DISCOVER);
      } else if (key.includes('message') || key.includes('chat')) {
        navigate(ROUTES.INBOX);
      } else {
        navigate(ROUTES.INBOX);
      }
    });
  }, [navigate]);
  return null;
}
