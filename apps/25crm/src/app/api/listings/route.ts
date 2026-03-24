import { NextResponse } from 'next/server';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

// Initialize Firebase on the server
let app;
if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}
const firestore = getFirestore(app);

export async function GET() {
    try {
        const listingsRef = collection(firestore, 'propertyListings');
        const q = query(listingsRef, orderBy('updatedAt', 'desc'));
        const querySnapshot = await getDocs(q);

        const listings = querySnapshot.docs.map(doc => {
            const data = doc.data();
            // Firestore timestamps need to be converted for JSON serialization
            if (data.updatedAt) {
                data.updatedAt = data.updatedAt.toDate().toISOString();
            }
            return data;
        });

        return NextResponse.json(listings);

    } catch (error) {
        console.error('Error fetching property listings:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

    