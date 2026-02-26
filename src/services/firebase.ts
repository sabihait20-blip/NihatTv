import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, push, onDisconnect, set, serverTimestamp } from "firebase/database";
import { AppSettings, Banners, Category, Channel, Highlight, Match } from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyCJeCM2sWUY8izlm6Z_T7u4goeRCOxZnaY",
  authDomain: "livefy-9623e.firebaseapp.com",
  databaseURL: "https://livefy-9623e-default-rtdb.firebaseio.com",
  projectId: "livefy-9623e",
  storageBucket: "livefy-9623e.appspot.com",
  messagingSenderId: "211410916294",
  appId: "1:211410916294:web:660f3dfc6ede9a862718c7",
  measurementId: "G-87CYDP39Q2"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

export const subscribeToSettings = (callback: (settings: AppSettings) => void) => {
  const settingsRef = ref(db, 'settings');
  return onValue(settingsRef, (snapshot) => {
    callback(snapshot.val());
  });
};

export const subscribeToBanners = (callback: (banners: Banners) => void) => {
  const bannersRef = ref(db, 'banners');
  return onValue(bannersRef, (snapshot) => {
    callback(snapshot.val());
  });
};

export const subscribeToMatches = (callback: (matches: Match[]) => void) => {
  const matchesRef = ref(db, 'matches');
  return onValue(matchesRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const matchesArray = Object.keys(data).map(id => ({ id, ...data[id] }));
      matchesArray.sort((a, b) => (a.order || 0) - (b.order || 0));
      callback(matchesArray);
    } else {
      callback([]);
    }
  });
};

export const subscribeToChannels = (callback: (channels: Channel[]) => void) => {
  const channelsRef = ref(db, 'liveChannels');
  return onValue(channelsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback(Object.keys(data).map(id => ({ id, ...data[id] })));
    } else {
      callback([]);
    }
  });
};

export const subscribeToHighlights = (callback: (highlights: Highlight[]) => void) => {
  const highlightsRef = ref(db, 'highlights');
  return onValue(highlightsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback(Object.keys(data).map(id => ({ id, ...data[id] })));
    } else {
      callback([]);
    }
  });
};

export const subscribeToCategories = (path: string, callback: (categories: Category[]) => void) => {
  const categoriesRef = ref(db, path);
  return onValue(categoriesRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback(Object.keys(data).map(id => ({ id, ...data[id] })));
    } else {
      callback([]);
    }
  });
};

export const setupOnlineCounter = (callback: (count: number) => void) => {
  const onlineUsersRef = ref(db, 'onlineUsers');
  const connectedRef = ref(db, '.info/connected');

  onValue(connectedRef, (snapshot) => {
    if (snapshot.val() === true) {
      const userRef = push(onlineUsersRef);
      onDisconnect(userRef).remove();
      set(userRef, true);
    }
  });

  return onValue(onlineUsersRef, (snapshot) => {
    callback(snapshot.size);
  });
};
