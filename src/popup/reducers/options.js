const initialState = {
	themeMainColor: { r: 195, g: 147, b: 220, a: 1 },
	themeSubColor: { r: 0, g: 0, b: 0, a: 1 },
	display: {
		experience: true,
		experienceTheme: true,
		extensions: true,
		extensionsNotifications: true,
		extensionsHistory: true,
		extensionsAutoState: true,
		autoStateBasics: true,
		userscripts: true,
		advanced: true,
		advancedBasics: true,
		advancedClean: true,
		advancedBackup: true,
	},
};

const options = (state = initialState, action) => {
	switch (action.type) {
		case 'OPTIONS_UPDATE_THEME_MAIN_COLOR':
			state.themeMainColor = action.color || { r: 195, g: 147, b: 220, a: 1 };
			break;
		case 'OPTIONS_UPDATE_THEME_SUB_COLOR':
			state.themeSubColor = action.color || { r: 0, g: 0, b: 0, a: 1 };
			break;
		case 'OPTIONS_TOGGLE_DISPLAY':
			state.display[action.name] = !state.display[action.name];
			break;
	}
	return JSON.parse(JSON.stringify(state));
};

export default options;
