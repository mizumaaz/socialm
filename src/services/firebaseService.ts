import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  onSnapshot,
  where
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { db, storage } from '@/config/firebase';

interface User {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
}

interface FirebasePost {
  id?: string;
  content: string;
  image_url?: string;
  created_at: any;
  updated_at: any;
  user_id: string;
  user_name: string;
  user_username: string;
  user_avatar: string | null;
  source: 'firebase';
  likes_count: number;
  comments_count: number;
}

export const firebasePostService = {
  // Create a new post in Firebase
  async createPost(content: string, imageFile: File | null, user: User): Promise<FirebasePost> {
    try {
      let imageUrl = null;

      // Upload image to Firebase Storage if provided
      if (imageFile) {
        const imageRef = ref(storage, `posts/${user.id}/${Date.now()}-${imageFile.name}`);
        const uploadResult = await uploadBytes(imageRef, imageFile);
        imageUrl = await getDownloadURL(uploadResult.ref);
      }

      // Create post document in Firestore
      const postData = {
        content,
        image_url: imageUrl,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        user_id: user.id,
        user_name: user.name,
        user_username: user.username,
        user_avatar: user.avatar,
        source: 'firebase' as const,
        likes_count: 0,
        comments_count: 0
      };

      const docRef = await addDoc(collection(db, 'posts'), postData);
      
      return {
        id: docRef.id,
        ...postData,
        created_at: new Date(),
        updated_at: new Date()
      };
    } catch (error) {
      console.error('Error creating Firebase post:', error);
      throw error;
    }
  },

  // Get posts from Firebase
  async getPosts(limitCount: number = 20): Promise<FirebasePost[]> {
    try {
      const postsQuery = query(
        collection(db, 'posts'),
        orderBy('created_at', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(postsQuery);
      const posts: FirebasePost[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        posts.push({
          id: doc.id,
          ...data,
          created_at: data.created_at?.toDate?.() || new Date(),
          updated_at: data.updated_at?.toDate?.() || new Date()
        } as FirebasePost);
      });

      return posts;
    } catch (error) {
      console.error('Error fetching Firebase posts:', error);
      return [];
    }
  },

  // Listen for real-time updates to posts
  subscribeToPosts(callback: (posts: FirebasePost[]) => void, limitCount: number = 20) {
    try {
      const postsQuery = query(
        collection(db, 'posts'),
        orderBy('created_at', 'desc'),
        limit(limitCount)
      );

      return onSnapshot(postsQuery, (querySnapshot) => {
        const posts: FirebasePost[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          posts.push({
            id: doc.id,
            ...data,
            created_at: data.created_at?.toDate?.() || new Date(),
            updated_at: data.updated_at?.toDate?.() || new Date()
          } as FirebasePost);
        });

        callback(posts);
      });
    } catch (error) {
      console.error('Error subscribing to Firebase posts:', error);
      return () => {}; // Return empty unsubscribe function
    }
  }
};

export const firebaseNotificationService = {
  // Create a notification in Firebase
  async createNotification(userId: string, type: string, content: string, referenceId?: string) {
    try {
      const notificationData = {
        user_id: userId,
        type,
        content,
        reference_id: referenceId || null,
        read: false,
        created_at: serverTimestamp(),
        source: 'firebase'
      };

      const docRef = await addDoc(collection(db, 'notifications'), notificationData);
      
      return {
        id: docRef.id,
        ...notificationData,
        created_at: new Date()
      };
    } catch (error) {
      console.error('Error creating Firebase notification:', error);
      throw error;
    }
  },

  // Get notifications for a user
  async getNotifications(userId: string, limitCount: number = 50) {
    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('user_id', '==', userId),
        orderBy('created_at', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(notificationsQuery);
      const notifications: any[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        notifications.push({
          id: doc.id,
          ...data,
          created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString()
        });
      });

      return notifications;
    } catch (error) {
      console.error('Error fetching Firebase notifications:', error);
      return [];
    }
  },

  // Subscribe to real-time notifications
  subscribeToNotifications(userId: string, callback: (notifications: any[]) => void) {
    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('user_id', '==', userId),
        orderBy('created_at', 'desc')
      );

      return onSnapshot(notificationsQuery, (querySnapshot) => {
        const notifications: any[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          notifications.push({
            id: doc.id,
            ...data,
            created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString()
          });
        });

        callback(notifications);
      });
    } catch (error) {
      console.error('Error subscribing to Firebase notifications:', error);
      return () => {}; // Return empty unsubscribe function
    }
  }
};