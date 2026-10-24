// Génère une paire de clés VAPID pour le push web (gratuit, aucun compte tiers).
import webpush from 'web-push';
const k = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${k.publicKey}\nVAPID_PRIVATE_KEY=${k.privateKey}\nVAPID_SUBJECT=mailto:contact@votre-domaine.fr`);
