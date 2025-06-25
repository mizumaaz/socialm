import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  query, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/config/firebase';
import { supabase } from '@/integrations/supabase/client';

export interface FirebasePost {
  id?: string;
  content: string;
  image_url?: string;
  user_id: string;
  user_name: string;
  user_username: string;
  user_avatar?: string;
  created_at: Timestamp;
  likes: string[];
  comments: FirebaseComment[];
  source: 'firebase';
}

export interface FirebaseComment {
  id: string;
  content: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  created_at: Timestamp;
}

export interface SupabasePost {
  id: string;
  content: string;
  image_url?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  profiles: {
    name: string;
    username: string;
    avatar?: string;
  };
  likes: { id: string; user_id: string }[];
  comments: {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    profiles: {
      name: string;
      avatar?: string;
    };
  }[];
  _count?: {
    likes: number;
    comments: number;
  };
  source: 'supabase';
}

export type UnifiedPost = FirebasePost | SupabasePost;

class FirebasePostService {
  private postsCollection = collection(db, 'posts');

  async createPost(
    content: string, 
    imageFile: File | null, 
    user: { id: string; name: string; username: string; avatar?: string }
  ): Promise<string> {
    try {
      let imageUrl = '';
      
      // Upload image to Firebase Storage if provided
      if (imageFile) {
        const imageRef = ref(storage, `posts/${user.id}/${Date.now()}-${imageFile.name}`);
        const snapshot = await uploadBytes(imageRef, imageFile);
        imageUrl = await getDownloadURL(snapshot.ref);
      }

      // Create post in Firebase
      const postData: Omit<FirebasePost, 'id'> = {
        content,
        image_url: imageUrl,
        user_id: user.id,
        user_name: user.name,
        user_username: user.username,
        user_avatar: user.avatar || '',
        created_at: serverTimestamp() as Timestamp,
        likes: [],
        comments: [],
        source: 'firebase'
      };

      const docRef = await addDoc(this.postsCollection, postData);
      console.log('Post created in Firebase:', docRef.id);
      
      return docRef.id;
    } catch (error) {
      console.error('Firebase post creation failed:', error);
      
      // Fallback to Supabase
      try {
        let supabaseImageUrl = null;
        
        if (imageFile) {
          const fileExt = imageFile.name.split('.').pop();
          const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('posts')
            .upload(fileName, imageFile);

          if (!uploadError) {
            const { data } = supabase.storage
              .from('posts')
              .getPublicUrl(fileName);
            supabaseImageUrl = data.publicUrl;
          }
        }

        const { data, error } = await supabase
          .from('posts')
          .insert({
            content,
            user_id: user.id,
            image_url: supabaseImageUrl
          })
          .select()
          .single();

        if (error) throw error;
        
        console.log('Post created in Supabase as fallback:', data.id);
        return data.id;
      } catch (fallbackError) {
        console.error('Both Firebase and Supabase failed:', fallbackError);
        throw new Error('Failed to create post');
      }
    }
  }

  async toggleLike(postId: string, userId: string): Promise<void> {
    try {
      const postRef = doc(this.postsCollection, postId);
      
      // Get current post to check if user already liked
      const postDoc = await getDocs(query(this.postsCollection));
      const post = postDoc.docs.find(doc => doc.id === postId)?.data() as FirebasePost;
      
      if (!post) throw new Error('Post not found');
      
      const isLiked = post.likes?.includes(userId);
      
      if (isLiked) {
        await updateDoc(postRef, {
          likes: arrayRemove(userId)
        });
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(userId)
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      throw error;
    }
  }

  async addComment(
    postId: string, 
    content: string, 
    user: { id: string; name: string; avatar?: string }
  ): Promise<void> {
    try {
      const postRef = doc(this.postsCollection, postId);
      
      const comment: FirebaseComment = {
        id: `comment_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        content,
        user_id: user.id,
        user_name: user.name,
        user_avatar: user.avatar || '',
        created_at: serverTimestamp() as Timestamp
      };

      await updateDoc(postRef, {
        comments: arrayUnion(comment)
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }

  async getPosts(): Promise<FirebasePost[]> {
    try {
      const q = query(this.postsCollection, orderBy('created_at', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        source: 'firebase'
      })) as FirebasePost[];
    } catch (error) {
      console.error('Error fetching Firebase posts:', error);
      return [];
    }
  }

  subscribeToRealTimeUpdates(callback: (posts: FirebasePost[]) => void): () => void {
    const q = query(this.postsCollection, orderBy('created_at', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      const posts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        source: 'firebase'
      })) as FirebasePost[];
      
      callback(posts);
    }, (error) => {
      console.error('Firebase real-time subscription error:', error);
    });
  }
}

export const firebasePostService = new FirebasePostService();