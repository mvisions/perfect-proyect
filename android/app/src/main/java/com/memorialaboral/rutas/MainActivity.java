package com.memorialaboral.rutas;

import android.content.Intent;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

	@Override
	public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}

	@Override
	protected void onActivityResult(int requestCode, int resultCode, Intent data) {
		super.onActivityResult(requestCode, resultCode, data);

		if (requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN || requestCode > GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
			return;
		}

		if (getBridge() == null) return;
		PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
		if (pluginHandle != null && pluginHandle.getInstance() instanceof SocialLoginPlugin) {
			((SocialLoginPlugin) pluginHandle.getInstance()).handleGoogleLoginIntent(requestCode, data);
		}
	}
}