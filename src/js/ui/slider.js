// slider.js - Slider UI class
import { state, fill, stroke, text, textSize, strokeWeight } from '../state.js'

class Slider {
	constructor(x, y, w, h, scenes, label, min, max, settingName, callback) {
		this.x = x
		this.y = y
		this.h = h
		this.w = Math.max(w, 350)
		this.name = settingName
		this.scenes = Array.isArray(scenes) ? scenes : [scenes]
		this.label = label
		this.min = min
		this.max = max
		this.sliding = false
		this.callback = callback
	}
	draw() {
		if (!this.scenes.includes(state.screen)) return
		let current = (state.settings[this.name] - this.min) / (this.max - this.min)

		state.ctx.beginPath()
		strokeWeight(2)
		stroke(0)
		fill(85)
		state.ctx.rect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h)
		state.ctx.stroke()
		state.ctx.fill()

		let value = Math.round(state.settings[this.name])
		state.ctx.beginPath()
		fill(130)
		let x = this.x - (this.w - 10) / 2 + (this.w - 10) * current - 5
		state.ctx.fillRect(x, this.y - this.h / 2, 10, this.h)

		fill(255, 255, 255)
		textSize(16)
		state.ctx.textAlign = 'center'
		text(`${this.label}: ${value}`, this.x, this.y + this.h / 8)
	}
	click() {
		if (!state.mouseDown || !this.scenes.includes(state.screen)) return false
		if (state.mouseX > this.x - this.w / 2 && state.mouseX < this.x + this.w / 2 && state.mouseY > this.y - this.h / 2 && state.mouseY < this.y + this.h / 2) {
			let current = (state.mouseX - this.x + this.w / 2) / this.w
			if (current < 0) current = 0
			if (current > 1) current = 1
			this.sliding = true
			state.settings[this.name] = current * (this.max - this.min) + this.min
			this.callback(current * (this.max - this.min) + this.min)
			this.draw()
		}
	}
	drag() {
		if (!this.sliding || !this.scenes.includes(state.screen)) return false
		let current = (state.mouseX - this.x + this.w / 2) / this.w
		if (current < 0) current = 0
		if (current > 1) current = 1
		state.settings[this.name] = current * (this.max - this.min) + this.min
		this.callback(current * (this.max - this.min) + this.min)
	}
	release() { this.sliding = false }

	static draw() {
		for (let slider of Slider.all) slider.draw()
	}
	static click() {
		for (let slider of Slider.all) slider.click()
	}
	static release() {
		for (let slider of Slider.all) slider.release()
	}
	static drag() {
		if (state.mouseDown) {
			for (let slider of Slider.all) slider.drag()
		}
	}
	static add(x, y, w, h, scenes, label, min, max, defaut, callback) {
		Slider.all.push(new Slider(x, y, w, h, scenes, label, min, max, defaut, callback))
	}
}
Slider.all = []

export { Slider }
