// Extensions WebXR avancées pour Meta Quest et autres casques
class WebXREnhancedFeatures {
    constructor(screenCaster) {
        this.screenCaster = screenCaster;
        this.xrSession = null;
        this.xrSpace = null;
        this.xrFrame = null;
        this.controllers = [];
        this.handTracking = null;
        this.passthrough = null;
        this.multicastSessions = new Map(); // Pour gérer plusieurs casques
        
        this.initializeAdvancedFeatures();
    }

    async initializeAdvancedFeatures() {
        // Vérifier les fonctionnalités WebXR disponibles
        await this.checkWebXRFeatures();
        
        // Initialiser le support multi-casques
        this.initializeMulticast();
        
        // Configurer les contrôleurs et le hand tracking
        this.setupControllers();
        
        // Initialiser le passthrough pour Meta Quest
        this.initializePassthrough();
    }

    async checkWebXRFeatures() {
        if (!('xr' in navigator)) {
            console.log('WebXR non disponible');
            return;
        }

        const features = {
            'immersive-vr': false,
            'immersive-ar': false,
            'hand-tracking': false,
            'local-floor': false,
            'bounded-floor': false,
            'unbounded': false,
            'layers': false
        };

        for (const [feature, _] of Object.entries(features)) {
            try {
                features[feature] = await navigator.xr.isSessionSupported('immersive-vr', {
                    requiredFeatures: [feature]
                });
            } catch (e) {
                features[feature] = false;
            }
        }

        console.log('Fonctionnalités WebXR supportées:', features);
        this.supportedFeatures = features;
        
        // Mettre à jour l'interface utilisateur
        this.updateWebXRUI(features);
    }

    updateWebXRUI(features) {
        const webxrStatus = document.getElementById('webxrStatus');
        const webxrInfo = document.getElementById('webxrInfo');
        
        let statusText = 'Fonctionnalités: ';
        const supportedList = [];
        
        if (features['immersive-vr']) supportedList.push('VR');
        if (features['immersive-ar']) supportedList.push('AR');
        if (features['hand-tracking']) supportedList.push('Hand Tracking');
        if (features['layers']) supportedList.push('Layers');
        
        statusText += supportedList.join(', ') || 'Basiques uniquement';
        webxrStatus.textContent = statusText;
        
        // Ajouter des boutons spécifiques selon les fonctionnalités
        this.addWebXRButtons(features);
    }

    addWebXRButtons(features) {
        const container = document.querySelector('.card:last-child');
        
        // Bouton AR si supporté
        if (features['immersive-ar']) {
            const arButton = document.createElement('button');
            arButton.textContent = '🌍 Mode AR';
            arButton.onclick = () => this.enterAR();
            container.querySelector('.button-group').appendChild(arButton);
        }
        
        // Bouton Hand Tracking si supporté
        if (features['hand-tracking']) {
            const handButton = document.createElement('button');
            handButton.textContent = '👋 Hand Tracking';
            handButton.onclick = () => this.toggleHandTracking();
            container.querySelector('.button-group').appendChild(handButton);
        }
        
        // Bouton Passthrough pour Meta Quest
        if (this.isMetaDevice()) {
            const passthroughButton = document.createElement('button');
            passthroughButton.textContent = '👁️ Passthrough';
            passthroughButton.onclick = () => this.togglePassthrough();
            container.querySelector('.button-group').appendChild(passthroughButton);
        }
    }

    async enterVR() {
        try {
            const sessionInit = {
                requiredFeatures: ['local-floor'],
                optionalFeatures: ['hand-tracking', 'layers', 'bounded-floor']
            };

            this.xrSession = await navigator.xr.requestSession('immersive-vr', sessionInit);
            
            // Configurer les événements de session
            this.setupXRSession();
            
            // Continuer le partage d'écran en VR
            if (this.screenCaster.isSharing) {
                await this.setupVRScreenSharing();
            }
            
            console.log('Session VR démarrée avec succès');
            
        } catch (error) {
            console.error('Erreur lors de l\'entrée en VR:', error);
            throw error;
        }
    }

    async enterAR() {
        try {
            const sessionInit = {
                requiredFeatures: ['local-floor'],
                optionalFeatures: ['hand-tracking', 'light-estimation', 'hit-test']
            };

            this.xrSession = await navigator.xr.requestSession('immersive-ar', sessionInit);
            this.setupXRSession();
            
            console.log('Session AR démarrée avec succès');
            
        } catch (error) {
            console.error('Erreur lors de l\'entrée en AR:', error);
            throw error;
        }
    }

    setupXRSession() {
        if (!this.xrSession) return;

        // Gérer la fin de session
        this.xrSession.addEventListener('end', () => {
            this.xrSession = null;
            this.xrSpace = null;
            console.log('Session XR terminée');
        });

        // Configurer l'espace de référence
        this.xrSession.requestReferenceSpace('local-floor')
            .then(space => {
                this.xrSpace = space;
                this.startXRLoop();
            })
            .catch(error => {
                console.error('Erreur espace de référence:', error);
                // Fallback vers 'viewer'
                return this.xrSession.requestReferenceSpace('viewer');
            })
            .then(space => {
                if (!this.xrSpace) {
                    this.xrSpace = space;
                    this.startXRLoop();
                }
            });

        // Configurer les contrôleurs
        this.setupXRControllers();
    }

    startXRLoop() {
        if (!this.xrSession || !this.xrSpace) return;

        this.xrSession.requestAnimationFrame((time, frame) => {
            this.xrFrame = frame;
            this.updateXRFrame(time, frame);
            
            if (this.xrSession) {
                this.startXRLoop(); // Continuer la boucle
            }
        });
    }

    updateXRFrame(time, frame) {
        // Mettre à jour les contrôleurs
        this.updateControllers(frame);
        
        // Mettre à jour le hand tracking
        if (this.handTracking) {
            this.updateHandTracking(frame);
        }
        
        // Mettre à jour la position de l'écran virtuel
        this.updateVirtualScreen(frame);
    }

    setupXRControllers() {
        if (!this.xrSession) return;

        this.xrSession.addEventListener('inputsourceschange', (event) => {
            event.added.forEach(inputSource => {
                console.log('Contrôleur ajouté:', inputSource);
                this.controllers.push(inputSource);
            });

            event.removed.forEach(inputSource => {
                console.log('Contrôleur retiré:', inputSource);
                const index = this.controllers.indexOf(inputSource);
                if (index > -1) {
                    this.controllers.splice(index, 1);
                }
            });
        });
    }

    updateControllers(frame) {
        this.controllers.forEach(controller => {
            if (controller.gripSpace) {
                const pose = frame.getPose(controller.gripSpace, this.xrSpace);
                if (pose) {
                    // Traiter la position/orientation du contrôleur
                    this.handleControllerInput(controller, pose);
                }
            }
        });
    }

    handleControllerInput(controller, pose) {
        // Gérer les entrées des contrôleurs
        if (controller.gamepad) {
            const gamepad = controller.gamepad;
            
            // Bouton trigger pour interagir
            if (gamepad.buttons[0] && gamepad.buttons[0].pressed) {
                this.handleTriggerPress(controller, pose);
            }
            
            // Joystick pour navigation
            if (gamepad.axes.length >= 2) {
                const x = gamepad.axes[0];
                const y = gamepad.axes[1];
                this.handleJoystickInput(x, y);
            }
        }
    }

    handleTriggerPress(controller, pose) {
        // Logique d'interaction avec l'interface VR
        console.log('Trigger pressé:', pose.transform.position);
        
        // Par exemple, pour arrêter/démarrer le partage
        if (this.screenCaster.isSharing) {
            // this.screenCaster.stopScreenShare();
        } else {
            // this.screenCaster.startScreenShare();
        }
    }

    handleJoystickInput(x, y) {
        // Navigation dans l'interface VR
        const threshold = 0.5;
        
        if (Math.abs(x) > threshold || Math.abs(y) > threshold) {
            console.log('Joystick:', x, y);
            // Implémenter la navigation
        }
    }

    async setupVRScreenSharing() {
        // Créer un layer pour afficher l'écran partagé en VR
        if (this.xrSession && this.screenCaster.localStream) {
            try {
                // Créer un canvas pour le stream vidéo
                const canvas = document.createElement('canvas');
                canvas.width = 1920;
                canvas.height = 1080;
                
                const ctx = canvas.getContext('2d');
                const video = document.createElement('video');
                video.srcObject = this.screenCaster.localStream;
                video.play();
                
                // Mettre à jour le canvas avec le stream vidéo
                const updateCanvas = () => {
                    if (video.readyState >= 2) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    }
                    if (this.xrSession) {
                        requestAnimationFrame(updateCanvas);
                    }
                };
                
                video.addEventListener('loadeddata', updateCanvas);
                
                console.log('Écran virtuel configuré pour VR');
                
            } catch (error) {
                console.error('Erreur configuration écran VR:', error);
            }
        }
    }

    // Support multi-casques
    initializeMulticast() {
        this.multicastSessions = new Map();
        
        // Écouter les nouvelles connexions de casques
        window.addEventListener('message', (event) => {
            if (event.data.type === 'NEW_HEADSET_CONNECTION') {
                this.handleNewHeadsetConnection(event.data);
            }
        });
    }

    handleNewHeadsetConnection(data) {
        const headsetId = data.headsetId;
        const connection = data.connection;
        
        console.log('Nouveau casque connecté:', headsetId);
        
        // Créer une session spécifique pour ce casque
        this.multicastSessions.set(headsetId, {
            connection: connection,
            peerConnection: null,
            stream: null
        });
        
        // Configurer la connexion WebRTC pour ce casque
        this.setupHeadsetConnection(headsetId);
    }

    async setupHeadsetConnection(headsetId) {
        const session = this.multicastSessions.get(headsetId);
        if (!session) return;

        // Créer une PeerConnection dédiée
        const peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        });

        session.peerConnection = peerConnection;

        // Ajouter le stream si disponible
        if (this.screenCaster.localStream) {
            this.screenCaster.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.screenCaster.localStream);
            });
        }

        // Gérer les événements ICE
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                session.connection.send(JSON.stringify({
                    type: 'ice-candidate',
                    candidate: event.candidate,
                    headsetId: headsetId
                }));
            }
        };

        console.log(`Connexion configurée pour casque ${headsetId}`);
    }

    // Hand Tracking
    async toggleHandTracking() {
        if (!this.supportedFeatures['hand-tracking']) {
            alert('Hand tracking non supporté');
            return;
        }

        if (this.handTracking) {
            this.handTracking = null;
            console.log('Hand tracking désactivé');
        } else {
            this.handTracking = {
                enabled: true,
                leftHand: null,
                rightHand: null
            };
            console.log('Hand tracking activé');
        }
    }

    updateHandTracking(frame) {
        if (!this.handTracking || !this.xrSession) return;

        // Obtenir les données des mains
        const inputSources = this.xrSession.inputSources;
        
        for (const inputSource of inputSources) {
            if (inputSource.hand) {
                const hand = inputSource.hand;
                const handedness = inputSource.handedness; // 'left' ou 'right'
                
                // Traiter les données de la main
                this.processHandData(hand, handedness, frame);
            }
        }
    }

    processHandData(hand, handedness, frame) {
        // Obtenir les positions des articulations de la main
        const joints = {};
        
        for (const [jointName, joint] of hand.entries()) {
            const pose = frame.getJointPose(joint, this.xrSpace);
            if (pose) {
                joints[jointName] = {
                    position: pose.transform.position,
                    orientation: pose.transform.orientation,
                    radius: pose.radius
                };
            }
        }
        
        // Stocker les données de la main
        this.handTracking[handedness + 'Hand'] = joints;
        
        // Détecter les gestes
        this.detectHandGestures(joints, handedness);
    }

    detectHandGestures(joints, handedness) {
        if (!joints['index-finger-tip'] || !joints['thumb-tip']) return;
        
        const indexTip = joints['index-finger-tip'].position;
        const thumbTip = joints['thumb-tip'].position;
        
        // Calculer la distance entre le pouce et l'index
        const distance = Math.sqrt(
            Math.pow(indexTip.x - thumbTip.x, 2) +
            Math.pow(indexTip.y - thumbTip.y, 2) +
            Math.pow(indexTip.z - thumbTip.z, 2)
        );
        
        // Geste de pincement (pinch)
        if (distance < 0.02) { // 2cm
            this.handlePinchGesture(handedness, indexTip);
        }
        
        // Geste de pointage
        if (this.isPointing(joints)) {
            this.handlePointGesture(handedness, indexTip);
        }
    }

    isPointing(joints) {
        // Logique pour détecter si la main pointe
        const indexTip = joints['index-finger-tip'];
        const indexMcp = joints['index-finger-metacarpal'];
        
        if (!indexTip || !indexMcp) return false;
        
        // Vérifier si l'index est étendu
        const fingerLength = Math.sqrt(
            Math.pow(indexTip.position.x - indexMcp.position.x, 2) +
            Math.pow(indexTip.position.y - indexMcp.position.y, 2) +
            Math.pow(indexTip.position.z - indexMcp.position.z, 2)
        );
        
        return fingerLength > 0.08; // 8cm approximatif pour un doigt étendu
    }

    handlePinchGesture(handedness, position) {
        console.log(`Geste de pincement détecté (${handedness})`, position);
        
        // Action spécifique selon le geste
        if (handedness === 'right') {
            // Démarrer/arrêter le partage d'écran
            if (this.screenCaster.isSharing) {
                this.screenCaster.stopScreenShare();
            } else {
                this.screenCaster.startScreenShare();
            }
        }
    }

    handlePointGesture(handedness, position) {
        console.log(`Geste de pointage détecté (${handedness})`, position);
        // Implémenter la navigation par pointage
    }

    // Passthrough pour Meta Quest
    async initializePassthrough() {
        if (!this.isMetaDevice()) return;
        
        try {
            // Vérifier si le passthrough est disponible
            if ('xr' in navigator && navigator.xr.requestSession) {
                console.log('Initialisation du passthrough Meta Quest');
                this.passthrough = {
                    available: true,
                    enabled: false
                };
            }
        } catch (error) {
            console.log('Passthrough non disponible:', error);
        }
    }

    async togglePassthrough() {
        if (!this.passthrough || !this.passthrough.available) {
            alert('Passthrough non disponible sur cet appareil');
            return;
        }

        try {
            if (this.passthrough.enabled) {
                // Désactiver le passthrough
                if (this.xrSession) {
                    // Logique spécifique Meta pour désactiver le passthrough
                    console.log('Désactivation du passthrough');
                    this.passthrough.enabled = false;
                }
            } else {
                // Activer le passthrough
                if (this.xrSession) {
                    // Logique spécifique Meta pour activer le passthrough
                    console.log('Activation du passthrough');
                    this.passthrough.enabled = true;
                }
            }
        } catch (error) {
            console.error('Erreur toggle passthrough:', error);
        }
    }

    isMetaDevice() {
        const userAgent = navigator.userAgent.toLowerCase();
        return userAgent.includes('oculus') || 
               userAgent.includes('meta') || 
               userAgent.includes('quest');
    }

    // Gestion des écrans virtuels multiples
    createVirtualScreen(position, rotation, scale = 1) {
        // Créer un écran virtuel dans l'espace VR
        const screenConfig = {
            position: position || { x: 0, y: 1.5, z: -2 },
            rotation: rotation || { x: 0, y: 0, z: 0 },
            scale: scale,
            width: 16 * scale,  // ratio 16:9
            height: 9 * scale
        };
        
        console.log('Écran virtuel créé:', screenConfig);
        return screenConfig;
    }

    updateVirtualScreen(frame) {
        // Mettre à jour la position de l'écran virtuel selon la position du casque
        if (!this.xrSession || !this.xrSpace) return;
        
        const pose = frame.getViewerPose(this.xrSpace);
        if (pose) {
            // Ajuster la position de l'écran virtuel
            // pour qu'il reste visible et confortable
            const headPosition = pose.transform.position;
            const headOrientation = pose.transform.orientation;
            
            // Logique de positionnement automatique de l'écran
            this.adjustVirtualScreenPosition(headPosition, headOrientation);
        }
    }

    adjustVirtualScreenPosition(headPosition, headOrientation) {
        // Calculer une position optimale pour l'écran virtuel
        const optimalDistance = 2.5; // 2.5 mètres devant l'utilisateur
        const optimalHeight = headPosition.y; // À la hauteur des yeux
        
        // Utiliser la rotation de la tête pour orienter l'écran
        const screenPosition = {
            x: headPosition.x,
            y: optimalHeight,
            z: headPosition.z - optimalDistance
        };
        
        // Mettre à jour l'écran virtuel
        // (Cette logique dépendrait de votre système de rendu)
        console.log('Position écran mise à jour:', screenPosition);
    }

    // Gestion des performances et optimisations
    optimizeForVR() {
        // Optimisations spécifiques pour VR
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        
        if (gl) {
            // Vérifier les extensions WebGL utiles pour VR
            const extensions = {
                multiview: gl.getExtension('OVR_multiview2'),
                foveated: gl.getExtension('OCULUS_multiview'),
                timingQuery: gl.getExtension('EXT_disjoint_timer_query_webgl2')
            };
            
            console.log('Extensions WebGL pour VR:', extensions);
            
            // Configurer le foveated rendering si disponible
            if (extensions.foveated) {
                this.setupFoveatedRendering(gl, extensions.foveated);
            }
        }
    }

    setupFoveatedRendering(gl, extension) {
        // Configuration du rendu fovéal pour améliorer les performances
        console.log('Configuration du rendu fovéal');
        
        // Cette fonctionnalité réduirait la qualité de rendu
        // dans la périphérie pour améliorer les performances
    }

    // Analytics et métriques VR
    startVRMetrics() {
        if (!this.xrSession) return;
        
        this.vrMetrics = {
            frameRate: 0,
            frameTime: 0,
            droppedFrames: 0,
            batteryLevel: null,
            thermalState: null
        };
        
        // Collecter les métriques en continu
        this.metricsInterval = setInterval(() => {
            this.collectVRMetrics();
        }, 1000);
    }

    collectVRMetrics() {
        if (!this.xrSession) return;
        
        // Obtenir les métriques de performance
        const now = performance.now();
        if (this.lastFrameTime) {
            this.vrMetrics.frameTime = now - this.lastFrameTime;
            this.vrMetrics.frameRate = 1000 / this.vrMetrics.frameTime;
        }
        this.lastFrameTime = now;
        
        // Log des métriques (pourrait être envoyé à un service d'analytics)
        console.log('VR Metrics:', this.vrMetrics);
    }

    stopVRMetrics() {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
            this.metricsInterval = null;
        }
    }

    // Sauvegarde et restauration de session
    saveVRSession() {
        const sessionData = {
            position: this.xrSpace ? 'saved' : null,
            settings: {
                quality: document.getElementById('qualityPreset').value,
                resolution: document.getElementById('resolution').value,
                autoQuality: document.getElementById('autoQuality').checked,
                lowLatency: document.getElementById('lowLatency').checked
            },
            connectedHeadsets: Array.from(this.multicastSessions.keys()),
            timestamp: Date.now()
        };
        
        localStorage.setItem('vrSession', JSON.stringify(sessionData));
        console.log('Session VR sauvegardée');
    }

    restoreVRSession() {
        const savedSession = localStorage.getItem('vrSession');
        if (!savedSession) return;
        
        try {
            const sessionData = JSON.parse(savedSession);
            
            // Restaurer les paramètres
            if (sessionData.settings) {
                document.getElementById('qualityPreset').value = sessionData.settings.quality;
                document.getElementById('resolution').value = sessionData.settings.resolution;
                document.getElementById('autoQuality').checked = sessionData.settings.autoQuality;
                document.getElementById('lowLatency').checked = sessionData.settings.lowLatency;
            }
            
            console.log('Session VR restaurée:', sessionData);
            
        } catch (error) {
            console.error('Erreur restauration session:', error);
        }
    }

    // Nettoyage des ressources
    cleanup() {
        // Arrêter les métriques
        this.stopVRMetrics();
        
        // Fermer la session XR
        if (this.xrSession) {
            this.xrSession.end();
        }
        
        // Nettoyer les connexions multi-casques
        this.multicastSessions.forEach((session, headsetId) => {
            if (session.peerConnection) {
                session.peerConnection.close();
            }
        });
        this.multicastSessions.clear();
        
        // Sauvegarder la session avant nettoyage
        this.saveVRSession();
        
        console.log('Ressources WebXR nettoyées');
    }
}

// Extension du WebXRScreenCaster principal
class ExtendedWebXRScreenCaster extends WebXRScreenCaster {
    constructor() {
        super();
        this.enhancedFeatures = new WebXREnhancedFeatures(this);
        
        // Intégrer les fonctionnalités avancées
        this.setupEnhancedIntegration();
    }

    setupEnhancedIntegration() {
        // Remplacer la méthode enterVR par la version avancée
        const originalEnterVR = this.enterVR.bind(this);
        this.enterVR = async () => {
            try {
                await this.enhancedFeatures.enterVR();
                this.enhancedFeatures.startVRMetrics();
                document.getElementById('enterVrBtn').textContent = '👁️ Sortir de VR';
            } catch (error) {
                console.error('Erreur VR avancée:', error);
                // Fallback vers la méthode originale
                return originalEnterVR();
            }
        };

        // Gérer la fermeture propre
        window.addEventListener('beforeunload', () => {
            this.enhancedFeatures.cleanup();
        });

        // Restaurer la session au démarrage
        this.enhancedFeatures.restoreVRSession();
    }

    // Méthode pour gérer plusieurs casques simultanément
    async connectMultipleHeadsets(headsetList) {
        console.log('Connexion de plusieurs casques:', headsetList);
        
        for (const headset of headsetList) {
            try {
                await this.enhancedFeatures.setupHeadsetConnection(headset.id);
                console.log(`Casque ${headset.id} connecté`);
            } catch (error) {
                console.error(`Erreur connexion casque ${headset.id}:`, error);
            }
        }
    }
}

// Remplacer l'instance principale par la version étendue
if (typeof window !== 'undefined') {
    // Attendre que l'instance originale soit créée, puis la remplacer
    window.addEventListener('load', () => {
        setTimeout(() => {
            if (window.app && window.app instanceof WebXRScreenCaster) {
                window.app = new ExtendedWebXRScreenCaster();
                console.log('WebXR Screen Caster étendu initialisé');
            }
        }, 1000);
    });
}