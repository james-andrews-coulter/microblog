export class MicropubStore {
	constructor() {}

	async createFile(filename, content) {
		console.log('MicropubStore.createFile', filename, content)
		return filename
	}

	async updateFile(filename, content) {
		console.log('MicropubStore.updateFile', filename, content)
		return filename
	}

	async uploadImage(filename, file) {
		console.log('MicropubStore.uploadImage', filename, file.filename)
		return filename
	}

	async getFile(filename) {
		console.log('MicropubStore.getFile', filename)
		return { filename, content: 'lorem ipsum' }
	}

	async getDirectory(dir) {
		console.log('MicropubStore.getDirectory', dir)
		return { files: [] }
	}

	async deleteFile(filename) {
		console.log('MicropubStore.deleteFile', filename)
		return filename
	}
}
