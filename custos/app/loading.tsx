export default function RootLoading() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
            <div className="text-center">
                <div className="relative inline-flex">
                    <div className="h-16 w-16 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
                </div>
                <p className="mt-4 text-gray-500 font-medium text-sm tracking-wide">Loading CUSTOS...</p>
            </div>
        </div>
    );
}
