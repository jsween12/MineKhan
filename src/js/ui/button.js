// button.js - Button UI class
import { state, fill, stroke, text, textSize, strokeWeight, HAND, cursor } from '../state.js'

class Button {
	constructor(x, y, w, h, labels, scenes, callback, disabled, hoverText) {
		this.x = x
		this.y = y
		this.h = h
		this.w = w
		this.index = 0
		this.disabled = disabled || (() => false)
		this.hoverText = !hoverText || typeof hoverText === "string" ? () => hoverText : hoverText
		this.scenes = Array.isArray(scenes) ? scenes : [scenes]
		this.labels = Array.isArray(labels) ? labels : [labels]
		this.callback = callback
	}
	mouseIsOver() {
		return state.mouseX >= this.x - this.w / 2 && state.mouseX <= this.x + this.w / 2 && state.mouseY >= this.y - this.h / 2 && state.mouseY <= this.y + this.h / 2
	}
	draw() {
		if (!this.scenes.includes(state.screen)) return
		let hovering = this.mouseIsOver()
		let disabled = this.disabled()
		let hoverText = this.hoverText()

		state.ctx.beginPath()
		if (hovering && !disabled) {
			strokeWeight(7)
			stroke(255)
			cursor(HAND)
		} else {
			strokeWeight(3)
			stroke(0)
		}
		if (disabled) fill(60)
		else fill(120)
		state.ctx.rect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h)
		state.ctx.stroke()
		state.ctx.fill()

		fill(255)
		textSize(16)
		state.ctx.textAlign = 'center'
		const label = this.labels[this.index]
		text(label.call ? label() : label, this.x, this.y + this.h / 8)

		if (hovering && hoverText) {
			let hoverbox = state.win.hoverbox
			hoverbox.innerText = hoverText
			if (hoverbox.className.includes("hidden")) hoverbox.classList.remove("hidden")
			if (state.mouseY < state.height / 2) {
				hoverbox.style.bottom = ""
				hoverbox.style.top = state.mouseY + 10 + "px"
			} else {
				hoverbox.style.top = ""
				hoverbox.style.bottom = state.height - state.mouseY + 10 + "px"
			}
			if (state.mouseX < state.width / 2) {
				hoverbox.style.right = ""
				hoverbox.style.left = state.mouseX + 10 + "px"
			} else {
				hoverbox.style.left = ""
				hoverbox.style.right = state.width - state.mouseX + 10 + "px"
			}
		}
	}
	click() {
		if (this.disabled() || !state.mouseDown || !this.scenes.includes(state.screen)) return false
		if (this.mouseIsOver()) {
			this.index = (this.index + 1) % this.labels.length
			this.callback(this.labels[this.index])
			return true
		}
	}

	static draw() {
		if (state.screen !== "inventory" && state.screen !== "play") {
			state.win.hoverbox.classList.add("hidden")
		}
		for (let button of Button.all) button.draw()
	}
	static click() {
		for (let button of Button.all) {
			if (button.click()) {
				Button.draw()
				break
			}
		}
	}
	static add(x, y, w, h, labels, scenes, callback, disabled, hoverText) {
		Button.all.push(new Button(x, y, w, h, labels, scenes, callback, disabled, hoverText))
	}
}
Button.all = []

export { Button }
