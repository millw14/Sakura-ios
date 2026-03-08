package com.millw14.sakura;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.millw14.sakura.anime.AnimePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AnimePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
