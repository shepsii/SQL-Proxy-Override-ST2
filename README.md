Sencha has its own Sql proxy included with the framework, and it's great, except for now it doesn't have support for fields on your models that are arrays or integers.

If you've tried to save/load/read arrays or objects to a Sql proxy, and found them then existing at runtime as JSON strings, then this is the repo to solve your problems!

This is an override for the Sql proxy included in 2.3+ that will add this support to the proxy.

NB: this proxy uses my Bancha class system (Ban). Just put it in app/ban/data/proxy and make sure you do something like this before starting your server/app:

Ext.Loader.setPath({ 'Ban': 'app/ban' });

You will also need to require in this class somewhere so the override takes effect.
