import { App, PluginSettingTab, Setting } from 'obsidian';
import { AIAssistantPluginInterface } from './types';

export interface AIAssistantSettings {
	openaiApiKey: string;
	model: string;
	maxTokens: number;
	temperature: number;
}

export const DEFAULT_SETTINGS: AIAssistantSettings = {
	openaiApiKey: '',
	model: 'gpt-4o-mini',
	maxTokens: 1024,
	temperature: 0.7,
};

export class AIAssistantSettingTab extends PluginSettingTab {
	plugin: AIAssistantPluginInterface;

	constructor(app: App, plugin: AIAssistantPluginInterface) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl).setName('AI assistant').setHeading();

		new Setting(containerEl)
			.setName('API key')
			.setDesc('Your OpenAI API key')
			.addText(text => text
				.setPlaceholder('Enter API key')
				.setValue(this.plugin.settings.openaiApiKey)
				.onChange(async (value) => {
					this.plugin.settings.openaiApiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Model')
			.setDesc('The OpenAI model to use')
			.addDropdown(dropdown => dropdown
                .addOption('gpt-4o-mini', 'GPT-4o mini')
                .addOption('gpt-4o', 'GPT-4o')
                .addOption('gpt-4', 'GPT-4')
                .addOption('gpt-4o-turbo', 'GPT-4o turbo')
				.addOption('gpt-3.5-turbo', 'GPT-3.5 turbo')
				.setValue(this.plugin.settings.model)
				.onChange(async (value) => {
					this.plugin.settings.model = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Maximum tokens')
			.setDesc('Maximum number of tokens to generate')
			.addSlider(slider => slider
				.setLimits(256, 4096, 256)
				.setValue(this.plugin.settings.maxTokens)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.maxTokens = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Temperature')
			.setDesc('Controls randomness: lower is more focused, higher is more creative')
			.addSlider(slider => slider
				.setLimits(0, 2, 0.1)
				.setValue(this.plugin.settings.temperature)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.temperature = value;
					await this.plugin.saveSettings();
				}));
	}
}