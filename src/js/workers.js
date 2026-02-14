// workers.js - Web Worker pool for cave generation
import { state } from './state.js'

const initWorkers = (workerCode) => {
	const win = state.win
	if (!win.workers) {
		const workerURL = URL.createObjectURL(new Blob([workerCode], { type: "text/javascript" }))
		win.workers = []
		const jobQueue = []
		const workerCount = (navigator.hardwareConcurrency || 4) - 1 || 1
		for (let i = 0; i < workerCount; i++) {
			let worker = new Worker(workerURL, { name: `Cave Worker ${i + 1}` })
			worker.onmessage = e => {
				if (worker.resolve) worker.resolve(e.data)
				worker.resolve = null
				if (jobQueue.length) {
					let [data, resolve] = jobQueue.shift()
					worker.resolve = resolve
					worker.postMessage(data)
				}
				else win.workers.push(worker)
			}
			win.workers.push(worker)
		}
		win.doWork = (data, resolve) => {
			if (win.workers.length) {
				let worker = win.workers.pop()
				worker.resolve = resolve
				worker.postMessage(data)
			}
			else jobQueue.push([data, resolve])
		}
	}
}

export { initWorkers }
