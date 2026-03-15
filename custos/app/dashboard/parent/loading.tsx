export default function ParentLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6 lg:p-8 animate-pulse">
            {/* Header skeleton */}
            <div className="mb-8">
                <div className="h-8 w-52 bg-gray-200 rounded-lg mb-2" />
                <div className="h-4 w-72 bg-gray-200 rounded-lg" />
            </div>

            {/* Children cards */}
            <div className="space-y-4 mb-8">
                {[...Array(2)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl shadow-sm p-6">
                        <div className="flex items-center gap-4">
                            <div className="h-14 w-14 bg-gray-200 rounded-full" />
                            <div className="flex-1">
                                <div className="h-5 w-32 bg-gray-200 rounded mb-2" />
                                <div className="h-3 w-48 bg-gray-100 rounded" />
                            </div>
                            <div className="h-8 w-20 bg-gray-200 rounded-lg" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl shadow-sm p-5 flex flex-col items-center">
                        <div className="h-10 w-10 bg-gray-200 rounded-xl mb-3" />
                        <div className="h-4 w-20 bg-gray-200 rounded" />
                    </div>
                ))}
            </div>
        </div>
    );
}
