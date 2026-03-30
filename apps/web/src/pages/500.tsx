export default function InternalServerErrorPage() {
	return (
		<main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
			<p className="text-sm font-medium text-gray-500">500</p>
			<h1 className="mt-2 text-3xl font-semibold text-gray-900">
				Something went wrong
			</h1>
			<p className="mt-3 max-w-md text-sm text-gray-500">
				The app hit an unexpected error while rendering this page. Refresh and
				try again.
			</p>
		</main>
	);
}
