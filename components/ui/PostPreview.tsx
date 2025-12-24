import React from 'react';
import Button from './Button';

interface PostPreviewProps {
  platform: 'Instagram' | 'TikTok' | 'Twitter/X';
  imageUrl: string;
  caption: string;
  artistName?: string;
  videoUrl?: string;
  onShare: () => void;
}


// --- UI Icons ---
const HeartIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>;
const CommentIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.08-3.242A8.92 8.92 0 012 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM4.416 14.653a6.945 6.945 0 003.584.98c4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7c0 1.56.45 3.02 1.238 4.28l-.51 1.531 1.688-.562z" clipRule="evenodd" /></svg>;
const ShareIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" /></svg>;


const PostPreview: React.FC<PostPreviewProps> = ({ platform, imageUrl, caption, artistName = "Your Artist Name", videoUrl, onShare }) => {
    const renderContent = () => {
        switch (platform) {
            case 'Instagram':
                return (
                    <div className="w-full max-w-sm mx-auto bg-gray-900 border border-gray-700 rounded-lg overflow-hidden shadow-xl">
                        <div className="p-3 flex items-center gap-3 border-b border-gray-700">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500"></div>
                            <span className="font-semibold text-sm">{artistName.toLowerCase().replace(/\s/g, '_')}</span>
                        </div>
                        <div className="w-full aspect-square bg-gray-800 flex items-center justify-center">
                            {imageUrl ? (
                                <img src={imageUrl} alt="Post preview" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-gray-500 text-sm">Image Preview</span>
                            )}
                        </div>
                        <div className="p-3">
                            <div className="flex items-center gap-4">
                                <HeartIcon /> <CommentIcon /> <ShareIcon />
                            </div>
                            <p className="text-sm mt-3">
                                <span className="font-semibold mr-1">{artistName.toLowerCase().replace(/\s/g, '_')}</span>
                                {caption}
                            </p>
                        </div>
                    </div>
                );
            case 'Twitter/X':
                 return (
                    <div className="w-full max-w-sm mx-auto bg-gray-900 border border-gray-700 rounded-lg overflow-hidden shadow-xl p-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-500 flex-shrink-0"></div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-white">{artistName}</span>
                                    <span className="text-gray-500">@{artistName.toLowerCase().replace(/\s/g, '')}</span>
                                </div>
                                <p className="text-white whitespace-pre-wrap mt-1">{caption}</p>
                                {imageUrl && (
                                    <div className="mt-3 rounded-xl border border-gray-700 overflow-hidden">
                                        <img src={imageUrl} alt="Post preview" className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <div className="mt-3 flex items-center text-gray-500 gap-6">
                                    <CommentIcon /> <ShareIcon /> <HeartIcon />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'TikTok':
                return (
                    <div className="w-full max-w-[250px] mx-auto bg-black border-4 border-gray-700 rounded-3xl overflow-hidden shadow-xl aspect-[9/16] relative flex items-end">
                        {videoUrl ? (
                             <video key={videoUrl} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
                                <source src={videoUrl} type="video/mp4" />
                            </video>
                        ) : imageUrl ? (
                            <img src={imageUrl} alt="Post preview" className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                             <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                <span className="text-gray-500 text-sm">Video Preview</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
                        <div className="relative text-white p-3 z-10 space-y-2">
                             <p className="font-bold text-sm">@{artistName.toLowerCase().replace(/\s/g, '')}</p>
                             <p className="text-xs whitespace-pre-wrap">{caption}</p>
                             <p className="text-xs font-semibold flex items-center gap-2">♫ Original Sound - {artistName}</p>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="bg-gray-800/50 p-4 rounded-lg">
            {renderContent()}
            <Button 
              onClick={onShare} 
              variant="secondary" 
              className="w-full mt-3"
              size="sm"
            >
              Share on {platform}
            </Button>
        </div>
    );
};

export default PostPreview;